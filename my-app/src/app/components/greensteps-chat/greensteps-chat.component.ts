import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, effect, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Conversation } from 'aura-ai-chat';
import { filter } from 'rxjs';
import { GreenStepsChatService } from './greensteps-chat.service';
import type { ChatItineraryDraft, ChatTour, GreenStepsChatResult } from './greensteps-chat.types';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { LoginModalService } from '../../services/login-modal.service';
import { marked } from 'marked';
import { TourCardComponent } from './tour-card.component';
import { ItineraryTimelineComponent } from './itinerary-timeline.component';

function normalizePrompt(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

function parseBudget(value: string): number | null {
  const normalized = normalizePrompt(value);
  const explicitAmount = normalized.match(/(\d[\d.,]*)\s*(ty|trieu|tr|m|nghin|ngan|k|vnd|dong|d)(?![a-z])/u);
  const budgetCueAmount = explicitAmount ? null : normalized.match(/(?:ngan sach|chi phi|toi da|khong qua|duoi|muc chi|budget)[^\d]{0,32}(\d[\d.,]*)/u);
  const match = explicitAmount || budgetCueAmount;
  if (!match) return null;

  const rawAmount = match[1];
  let normalizedAmount = rawAmount;
  const dot = rawAmount.lastIndexOf('.');
  const comma = rawAmount.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) {
    normalizedAmount = comma > dot ? rawAmount.replace(/\./g, '').replace(',', '.') : rawAmount.replace(/,/g, '');
  } else if (dot >= 0 || comma >= 0) {
    const separator = dot >= 0 ? '.' : ',';
    const parts = rawAmount.split(separator);
    const trailingDigits = parts.at(-1)?.length ?? 0;
    normalizedAmount = parts.length > 2 || trailingDigits === 3
      ? rawAmount.replace(/[.,]/g, '')
      : rawAmount.replace(separator, '.');
  }

  const amount = Number(normalizedAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = explicitAmount?.[2] || '';
  const multiplier = unit === 'ty' ? 1_000_000_000
    : ['trieu', 'tr', 'm'].includes(unit) ? 1_000_000
      : ['nghin', 'ngan', 'k'].includes(unit) ? 1_000
        : 1;
  const budget = amount * multiplier;
  if (!unit && budget < 100_000) return null;
  return Math.round(budget);
}

export function isItineraryPrompt(value: string): boolean {
  const normalized = normalizePrompt(value);
  const hasPlanAction = /\b(?:lap|tao|len|xay dung|thiet ke|sap xep|soan)\b/.test(normalized);
  return /\b(?:lich trinh|lap lich(?: trinh| di(?: choi)?)?|len lich(?: trinh| di(?: choi)?)?|lich di(?: choi)?|hanh trinh|ke hoach(?: du lich| chuyen di)?)\b/.test(normalized)
    || (hasPlanAction && /\b(?:chuyen di|tour rieng)\b/.test(normalized));
}

@Component({
  selector: 'app-greensteps-chat',
  standalone: true,
  imports: [CommonModule, TourCardComponent, ItineraryTimelineComponent],
  templateUrl: './greensteps-chat.component.html',
  styleUrl: './greensteps-chat.component.css',
  host: { '[hidden]': '!isCustomerRoute()' }
})
export class GreenStepsChatComponent {
  readonly chat = inject(GreenStepsChatService);
  private readonly router = inject(Router);
  private readonly apiService = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly loginModalService = inject(LoginModalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly launcher = viewChild<ElementRef<HTMLButtonElement>>('launcher');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly composer = viewChild<ElementRef<HTMLInputElement>>('composer');
  private readonly transcriptElement = viewChild<ElementRef<HTMLElement>>('transcript');

  readonly isChatOpen = signal(false);
  readonly isCustomerRoute = signal(this.customerRoute(this.router.url));
  readonly historyOpen = signal(false);
  readonly conversations = signal<Conversation[]>([]);
  readonly draftMessage = signal('');
  readonly isCreatingItinerary = signal(false);
  readonly createItineraryError = signal('');
  readonly visibleTourCounts = signal<Record<string, number>>({});

  constructor() {
    effect(() => {
      this.chat.transcript();
      this.scrollTranscriptToBottom();
    });
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(event => {
      this.isCustomerRoute.set(this.customerRoute(event.urlAfterRedirects));
      if (!this.isCustomerRoute()) this.closeChat(false);
    });

    const viewport = window.visualViewport;
    const updateViewport = () => {
      this.host.nativeElement.style.setProperty('--gs-chat-viewport', `${viewport?.height ?? window.innerHeight}px`);
      this.host.nativeElement.style.setProperty('--gs-chat-keyboard', `${viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0}px`);
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    this.destroyRef.onDestroy(() => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    });
  }

  private customerRoute(url: string): boolean { return !/^\/(admin|partner)(?:[-/?#]|$)/.test(url); }

  async toggleChat(): Promise<void> {
    if (this.isChatOpen()) { this.closeChat(); return; }
    this.isChatOpen.set(true);
    this.historyOpen.set(false);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (!this.isChatOpen() || this.destroyRef.destroyed) return;
    const focusTarget = window.matchMedia('(max-width: 600px)').matches
      ? this.panel()?.nativeElement
      : this.composer()?.nativeElement;
    focusTarget?.focus({ preventScroll: true });
    this.scrollTranscriptToBottom();
  }

  closeChat(restoreFocus = true): void {
    this.isChatOpen.set(false);
    this.historyOpen.set(false);
    if (restoreFocus) requestAnimationFrame(() => {
      if (!this.isChatOpen() && !this.destroyRef.destroyed) this.launcher()?.nativeElement.focus({ preventScroll: true });
    });
  }

  async startNewChat(): Promise<void> {
    if (this.chat.isSending()) return;
    await this.chat.startNewConversation();
    this.draftMessage.set('');
    this.historyOpen.set(false);
    this.createItineraryError.set('');
    this.composer()?.nativeElement.focus({ preventScroll: true });
    this.scrollTranscriptToBottom();
  }

  async toggleHistory(): Promise<void> {
    if (this.historyOpen()) { this.historyOpen.set(false); return; }
    this.conversations.set(await this.chat.listConversations());
    this.historyOpen.set(true);
  }

  closeHistory(): void {
    this.historyOpen.set(false);
    requestAnimationFrame(() => {
      if (this.isChatOpen()) this.composer()?.nativeElement.focus({ preventScroll: true });
    });
  }

  async openConversation(conversation: Conversation): Promise<void> {
    if (this.chat.isSending()) return;
    await this.chat.loadConversation(conversation.id);
    this.historyOpen.set(false);
    this.createItineraryError.set('');
    this.scrollTranscriptToBottom();
    requestAnimationFrame(() => {
      if (this.isChatOpen()) this.composer()?.nativeElement.focus({ preventScroll: true });
    });
  }

  onComposerInput(event: Event): void {
    this.draftMessage.set((event.target as HTMLInputElement).value);
  }

  renderMarkdown(content: string): string {
    return marked.parse(content, { async: false }) as string;
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.submitMessage();
    }
  }

  async submitMessage(text = this.draftMessage()): Promise<void> {
    const message = text.trim();
    if (!message || this.chat.isSending()) return;
    this.draftMessage.set('');
    this.createItineraryError.set('');
    this.scrollTranscriptToBottom();
    try {
      await this.chat.sendMessage(message);
    } catch {
      // The service keeps the request error and the last user turn for retry.
    } finally {
      requestAnimationFrame(() => {
        if (this.isChatOpen() && !this.chat.isSending()) this.composer()?.nativeElement.focus({ preventScroll: true });
      });
      this.scrollTranscriptToBottom();
    }
  }

  sendSuggestedQuestion(question: string): void {
    this.draftMessage.set(question);
    void this.submitMessage(question);
  }

  visibleToursFor(messageId: string, result: GreenStepsChatResult): number {
    return Math.min(result.tours.length, this.visibleTourCounts()[messageId] ?? 3);
  }

  showMoreTours(result: GreenStepsChatResult, messageId: string): void {
    const visible = this.visibleToursFor(messageId, result);
    if (visible < result.tours.length) {
      this.visibleTourCounts.update(counts => ({ ...counts, [messageId]: Math.min(result.tours.length, visible + 3) }));
      return;
    }
    this.openToursPage(result.tours[0]?.destination);
  }

  trackTour(_: number, tour: ChatTour): string { return tour.id; }
  trackConversation(_: number, conversation: Conversation): string { return conversation.id; }

  openToursPage(destination?: string): void {
    this.router.navigate(['/tours'], { queryParams: destination ? { dest: destination } : undefined });
  }

  retryLastMessage(): void {
    const message = [...this.chat.transcript()].reverse().find(item => item.role === 'user');
    if (message) void this.submitMessage(message.content);
  }

  cancelMessage(): void { this.chat.cancelMessage(); }

  focusComposer(): void { this.composer()?.nativeElement.focus(); }

  itineraryIntroduction(plan: ChatItineraryDraft | null | undefined, messageId: string): string {
    if (!plan) return 'Mình đã chuẩn bị phương án lịch trình. Cùng xem kế hoạch nhé!';
    const nights = Math.max(0, plan.days.length - 1);
    const budget = this.targetBudgetFor(messageId);
    const budgetCopy = budget === null ? '' : ` phù hợp với ngân sách ${new Intl.NumberFormat('vi-VN').format(budget)} ₫ bạn nêu`;
    return `Mình đã chuẩn bị phương án ${plan.destination} ${plan.days.length} ngày${nights ? ` ${nights} đêm` : ''}${budgetCopy}. Cùng xem kế hoạch nhé!`;
  }

  targetBudgetFor(messageId: string): number | null {
    const transcript = this.chat.transcript();
    const assistantIndex = transcript.findIndex(message => message.id === messageId);
    if (assistantIndex < 0) return null;

    let budget: number | null = null;
    for (let index = assistantIndex - 1; index >= 0; index--) {
      const message = transcript[index];
      if (message.role !== 'user') continue;
      budget ??= parseBudget(message.content);
      if (isItineraryPrompt(message.content)) break;
    }
    return budget;
  }

  async createItineraryFromLatestPlan(): Promise<void> {
    const plan = this.chat.latestResult()?.itinerary;
    if (plan) await this.createItineraryFromPlan(plan);
  }

  async createItineraryFromPlan(plan: ChatItineraryDraft): Promise<void> {
    if (this.isCreatingItinerary()) return;
    if (!this.authService.getCurrentUser()) {
      this.createItineraryError.set('Đăng nhập để lưu lịch trình vào tài khoản. Bản nháp vẫn được giữ trong cuộc trò chuyện.');
      this.loginModalService.open();
      return;
    }

    this.isCreatingItinerary.set(true);
    this.createItineraryError.set('');
    try {
      const result = await this.apiService.createAiItinerary(plan);
      if (!result.success || !result.itineraryId) {
        this.createItineraryError.set(result.message || 'Chưa lưu được lịch trình. Bạn có thể thử lại.');
        return;
      }
      this.chat.currentItinerary.set(null);
      this.router.navigate(['/schedule', result.itineraryId]);
      this.closeChat(false);
    } catch {
      this.createItineraryError.set('Chưa lưu được lịch trình. Kiểm tra kết nối rồi thử lại.');
    } finally {
      this.isCreatingItinerary.set(false);
    }
  }

  adjustItinerary(plan: ChatItineraryDraft): void {
    this.draftMessage.set(`Điều chỉnh lịch trình ${plan.destination}: `);
    this.focusComposer();
  }

  private scrollTranscriptToBottom(): void {
    requestAnimationFrame(() => {
      const element = this.transcriptElement()?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }

  private focusableElements(): HTMLElement[] {
    const panel = this.panel()?.nativeElement;
    if (!panel) return [];
    return [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
  }

  private isLoginModalInteraction(path: EventTarget[]): boolean {
    return path.some(item => item instanceof Element && Boolean(item.closest('app-login-modal')));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isChatOpen()) return;
    const path = event.composedPath();
    if (path.includes(this.host.nativeElement) || this.isLoginModalInteraction(path)) return;
    this.closeChat(false);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isChatOpen() || event.defaultPrevented) return;
    const path = event.composedPath();
    if (this.isLoginModalInteraction(path)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeChat();
    } else if (event.key === 'Tab') {
      const elements = this.focusableElements();
      if (!elements.length) return;
      const inside = path.includes(this.host.nativeElement);
      const active = path.find(item => item instanceof HTMLElement) as HTMLElement | undefined;
      const target = !inside ? elements[0]
        : event.shiftKey && active === elements[0] ? elements.at(-1)
          : !event.shiftKey && active === elements.at(-1) ? elements[0] : undefined;
      if (target) { event.preventDefault(); target.focus(); }
    }
  }
}
