import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface AccountModalTab { id: string; label: string; }
export interface AccountModalField { label: string; value: unknown; key?: string; type?: 'text' | 'date' | 'email' | 'tel'; required?: boolean; }
export interface AccountModalRecord { title: string; detail?: string; meta?: string; status?: string; }
export interface AccountModalAction { id: string; label: string; icon?: string; disabled?: boolean; }

@Component({
  selector: 'app-account-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account-detail-modal.component.html',
  styleUrl: './account-detail-modal.component.css'
})
export class AccountDetailModalComponent implements OnDestroy {
  @Input({ required: true }) accountType: 'user' | 'provider' = 'user';
  @Input({ required: true }) account: any = null;
  @Input() tabs: AccountModalTab[] = [];
  @Input() activeTab = '';
  @Input() fields: AccountModalField[] = [];
  @Input() sectionHeading = '';
  @Input() emptyMessage = '';
  @Input() records: AccountModalRecord[] = [];
  @Input() canLoadMore = false;
  @Input() loadMoreBusy = false;
  @Input() actions: AccountModalAction[] = [];
  @Input() loading = false;
  @Input() error = '';
  @Input() editing = false;
  @Input() busy = false;
  @Input() editValues: Record<string, any> = {};
  @Input() editReason = '';
  @Output() editReasonChange = new EventEmitter<string>();
  @Output() tabChange = new EventEmitter<string>();
  @Output() retry = new EventEmitter<void>();
  @Output() loadMore = new EventEmitter<void>();
  @Output() editStart = new EventEmitter<void>();
  @Output() editCancel = new EventEmitter<void>();
  @Output() editSave = new EventEmitter<{ values: Record<string, any>; reason: string }>();
  @Output() lockToggle = new EventEmitter<{ reason: string }>();
  @Output() accountAction = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();
  public lockReason = '';
  private previousOverflow = '';

  constructor() {
    if (typeof document !== 'undefined') {
      this.previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
  }

  public ngOnDestroy(): void {
    if (typeof document !== 'undefined') document.body.style.overflow = this.previousOverflow;
  }

  @HostListener('document:keydown.escape')
  public onEscape(): void { if (!this.busy) this.close.emit(); }

  public submitEdit(): void {
    if (!this.editReason.trim() || this.busy) return;
    this.editSave.emit({ values: this.editValues, reason: this.editReason.trim() });
  }

  public submitLockToggle(): void {
    if (!this.lockReason.trim() || this.busy) return;
    this.lockToggle.emit({ reason: this.lockReason.trim() });
    this.lockReason = '';
  }

  public get suspended(): boolean { return this.account?.account_status === 'suspended' || this.account?.account_status === 'deactivated'; }
  public get canEdit(): boolean { return this.fields.some(field => Boolean(field.key)); }
  public get displayName(): string { return this.account?.displayName || this.account?.fullname || this.account?.username || 'Tài khoản'; }
  public get avatar(): string { return this.account?.avatarUrl || this.account?.image_url || ''; }
  public initials(name: string): string { return String(name || '?').trim().split(/\s+/).slice(-2).map(part => part[0] || '').join('').toLocaleUpperCase('vi') || '?'; }
  public displayValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'Chưa cung cấp';
    if (typeof value === 'boolean') return value ? 'Có' : 'Không';
    return String(value);
  }
}
