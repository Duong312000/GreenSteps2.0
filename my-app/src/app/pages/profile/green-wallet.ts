import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({ selector: 'app-green-wallet', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './green-wallet.html', styleUrl: './green-wallet.css' })
export class GreenWalletComponent implements OnInit, OnDestroy {
  data: any; error = ''; notice = ''; busy = false; hidden = false; modal = ''; all = false;
  amount = 50000; points = 1000; email = ''; bankName = ''; bankAccount = ''; accountHolder = ''; qrText = '';
  private timer?: ReturnType<typeof setInterval>;
  private key = crypto.randomUUID();
  demoModal = ''; demoStep = 'edit'; demoMethod = 'demo_bank'; demoBankId = ''; demoBankLabel = '';
  recipientQuery = ''; recipient: any = null; transferNote = ''; demoPayload: any = null;
  selectedTransaction: any = null; selectedLedger: any[] = []; demoQueue: any[] = [];
  demoHistory: any[] = []; historyPage = 0; historyTotal = 0;
  readonly suggestedAmounts = [50000, 100000, 200000, 500000];
  private demoKey = crypto.randomUUID();
  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}
  ngOnInit() { void this.refresh(); this.timer = setInterval(() => { if (!this.busy && document.visibilityState === 'visible') void this.refresh(); }, 15000); }
  ngOnDestroy() { clearInterval(this.timer); }
  async refresh() {
    try {
      this.data = await this.api.walletRequest('GET', '/overview');
      if (this.selectedTransaction && this.demoModal === 'demoDetail') await this.readDetail(this.selectedTransaction.id);
      this.error = '';
    } catch (e: any) {
      this.error = e.status === 0 ? 'Không kết nối được máy chủ GreenSteps. Vui lòng thử lại khi máy chủ hoạt động.'
        : e.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        : e.error?.message || 'Không thể tải ví. Vui lòng thử lại.';
    }
    this.cdr.markForCheck();
  }
  open(action: string) {
    this.notice = ''; this.error = '';
    if (['deposit', 'withdraw', 'moneyTransfer'].includes(action)) { this.openDemo(action); return; }
    this.modal = action; this.key = crypto.randomUUID();
  }
  openDemo(action: string) {
    this.demoModal = action; this.demoStep = 'edit'; this.demoKey = crypto.randomUUID(); this.demoPayload = null;
    this.recipient = null; this.recipientQuery = ''; this.transferNote = ''; this.demoBankLabel = ''; this.error = ''; this.notice = '';
    this.demoBankId = this.data?.demo?.banks?.[0]?.id || '';
  }
  get demoAvailable() { return this.data?.demo?.available_balance || 0; }
  get demoTitle() { return ({ deposit: 'Nạp tiền', withdraw: 'Rút tiền', moneyTransfer: 'Chuyển tiền', demoDetail: 'Chi tiết giao dịch', demoAdmin: 'Quản lý giao dịch', demoHistory: 'Lịch sử giao dịch' } as Record<string, string>)[this.demoModal] || ''; }
  statusLabel(status: string) { return ({ PENDING: 'Chờ xác nhận', SUCCESS: 'Thành công', FAILED: 'Thất bại', CANCELLED: 'Đã hủy', pending: 'Chờ xác minh', success: 'Hoàn tất', failed: 'Không thành công' } as Record<string, string>)[status] || status; }
  async findRecipient() {
    if (this.busy) return;
    this.busy = true; this.error = ''; this.recipient = null;
    try { this.recipient = (await this.api.walletRequest('GET', `/demo/recipient?q=${encodeURIComponent(this.recipientQuery.trim())}`)).recipient; }
    catch (e: any) { this.error = e.error?.message || 'Không tìm thấy người nhận.'; }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  prepareDemo() {
    this.error = '';
    if (!this.data?.demo?.account_enabled) { this.error = 'Tài khoản này chưa được bật ví thử nghiệm.'; return; }
    if (!Number.isSafeInteger(this.amount) || this.amount < 10000 || this.amount > 20000000) { this.error = 'Nhập số tiền từ 10.000đ đến 20.000.000đ.'; return; }
    if (this.demoModal !== 'deposit' && this.amount > this.demoAvailable) { this.error = 'Số dư khả dụng không đủ.'; return; }
    if (this.demoModal === 'withdraw' && !this.demoBankId) { this.error = 'Vui lòng chọn tài khoản ngân hàng.'; return; }
    if (this.demoModal === 'moneyTransfer' && !this.recipient) { this.error = 'Tìm và kiểm tra người nhận trước khi chuyển.'; return; }
    this.demoPayload = this.demoModal === 'deposit' ? { amount: this.amount, method: this.demoMethod } : this.demoModal === 'withdraw' ? { amount: this.amount, bankId: this.demoBankId } : { amount: this.amount, recipientId: this.recipient.id, note: this.transferNote.trim() };
    this.demoStep = 'review';
  }
  async commitDemo() {
    if (this.busy || !this.demoPayload) return;
    this.busy = true; this.error = '';
    try {
      const path = ({ deposit: 'deposits', withdraw: 'withdrawals', moneyTransfer: 'transfers' } as Record<string, string>)[this.demoModal];
      const result = await this.api.walletRequest('POST', `/demo/${path}`, this.demoPayload, this.demoKey);
      this.selectedTransaction = result.transaction; this.demoModal = 'demoDetail'; this.demoPayload = null;
      this.notice = result.transaction.status === 'SUCCESS' ? 'Giao dịch thành công.' : this.data?.demo?.can_simulate ? 'Yêu cầu đã tạo. Xác nhận trạng thái để hoàn tất giao dịch.' : 'Yêu cầu đang chờ quản trị viên xác nhận.';
      await this.refresh();
    } catch (e: any) { this.error = e.error?.message || 'Chưa hoàn tất giao dịch. Bạn có thể thử lại an toàn.'; }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  async createDemoBank() {
    if (this.busy) return; this.busy = true; this.error = '';
    try { const result = await this.api.walletRequest('POST', '/demo/banks', { label: this.demoBankLabel }); await this.refresh(); this.demoBankId = result.bank.id; this.demoBankLabel = ''; }
    catch (e: any) { this.error = e.error?.message || 'Không thể thêm tài khoản.'; }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  private async readDetail(id: string) { const detail = await this.api.walletRequest('GET', `/demo/transactions/${encodeURIComponent(id)}`); this.selectedTransaction = detail.transaction; this.selectedLedger = detail.ledger; }
  async showTransaction(tx: any) {
    if (tx.mode !== 'demo' || this.busy) return;
    this.busy = true; this.error = ''; this.demoModal = 'demoDetail'; this.selectedTransaction = null;
    try { await this.readDetail(tx.id); } catch (e: any) { this.error = e.error?.message || 'Không thể tải giao dịch.'; }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  async processDemo(tx: any, status: string) {
    if (this.busy) return; this.busy = true; this.error = '';
    try {
      await this.api.walletRequest('POST', `/demo/admin/transactions/${encodeURIComponent(tx.id)}/settle`, { status });
      await this.refresh(); if (this.demoModal === 'demoAdmin') this.demoQueue = (await this.api.walletRequest('GET', '/demo/admin/pending')).transactions;
      this.notice = `Giao dịch: ${this.statusLabel(status)}.`;
    } catch (e: any) { this.error = e.error?.message || 'Không thể xử lý giao dịch.'; }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  async cancelDemo() {
    if (this.busy || !this.selectedTransaction) return; this.busy = true; this.error = '';
    try { await this.api.walletRequest('POST', `/demo/transactions/${encodeURIComponent(this.selectedTransaction.id)}/cancel`, {}); await this.refresh(); this.notice = 'Đã hủy yêu cầu; khoản đang giữ đã được giải phóng.'; }
    catch (e: any) { this.error = e.error?.message || 'Không thể hủy yêu cầu.'; }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  async simulateDemo(status: string) {
    if (this.busy || !this.selectedTransaction) return;
    this.busy = true; this.error = '';
    try {
      await this.api.walletRequest('POST', `/demo/transactions/${encodeURIComponent(this.selectedTransaction.id)}/simulate`, { status });
      await this.refresh();
      this.notice = status === 'SUCCESS' ? 'Giao dịch thành công. Số dư đã được cập nhật.' : 'Giao dịch đã được đánh dấu thất bại. Khoản tiền đang giữ đã được giải phóng nếu có.';
    } catch (e: any) { this.error = e.error?.message || 'Không thể xác nhận giao dịch.'; }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  async openQueue() {
    this.demoModal = 'demoAdmin'; this.busy = true; this.error = '';
    try { this.demoQueue = (await this.api.walletRequest('GET', '/demo/admin/pending')).transactions; }
    catch (e: any) { this.error = e.error?.message || 'Không thể tải danh sách giao dịch.'; }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  async openHistory(page = 0) {
    if (this.busy) return; this.busy = true; this.error = ''; this.demoModal = 'demoHistory';
    try { const result = await this.api.walletRequest('GET', `/demo/transactions?page=${page}`); this.demoHistory = result.transactions; this.historyTotal = result.total; this.historyPage = page; }
    catch (e: any) { this.error = e.error?.message || 'Không thể tải lịch sử.'; }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  get visibleTransactions(): any[] { return (this.data?.transactions || []).slice(0, this.all ? 100 : 6); }
  get progress() { return this.data?.membership.next ? Math.min(100, this.data.membership.points / this.data.membership.next.threshold * 100) : 100; }
  async submit() {
    if (this.busy) return;
    this.busy = true; this.error = '';
    try {
      const paths: Record<string, string> = { transfer: '/points/transfer', redeem: '/points/redeem', method: '/methods' };
      if (this.modal === 'qr') {
        const uri = new URL(this.qrText);
        if (uri.protocol !== 'greensteps:' || uri.hostname !== 'points' || !uri.searchParams.get('email')) throw new Error('QR không phải yêu cầu chuyển điểm GreenSteps.');
        this.email = uri.searchParams.get('email')!; this.modal = 'transfer'; this.notice = 'Kiểm tra người nhận và số điểm trước khi chuyển.'; return;
      }
      const result = await this.api.walletRequest('POST', paths[this.modal], { amount: this.amount, points: this.points, email: this.email, bankName: this.bankName, bankAccount: this.bankAccount, accountHolder: this.accountHolder }, this.key);
      this.notice = result.message || (result.code ? `Đã đổi ưu đãi: ${result.code}. Nhập mã khi thanh toán booking.` : 'Đã cập nhật ví thành công.');
      this.modal = ''; this.key = crypto.randomUUID(); await this.refresh();
    } catch (e: any) { this.error = e.error?.message || e.message || 'Giao dịch chưa hoàn tất. Vui lòng thử lại.'; }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  async remove(id: string) { if (this.busy) return; this.busy = true; try { await this.api.walletRequest('DELETE', `/methods/${id}`); await this.refresh(); } catch { this.error = 'Không thể xóa phương thức.'; } finally { this.busy = false; this.cdr.markForCheck(); } }
  async scanFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) { this.error = 'Trình duyệt chưa hỗ trợ đọc ảnh QR. Dùng trình quét trên thiết bị rồi dán nội dung bên dưới.'; return; }
    this.busy = true;
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      const codes = await new Detector({ formats: ['qr_code'] }).detect(bitmap);
      if (!codes.length) throw new Error('Không tìm thấy QR trong ảnh.');
      this.qrText = codes[0].rawValue;
      this.busy = false;
      await this.submit();
    } catch (e: any) { this.error = e.message || 'Không thể đọc ảnh QR.'; }
    finally { bitmap?.close(); this.busy = false; this.cdr.markForCheck(); }
  }
  isPoints(tx: any) { return tx.type.startsWith('points_'); }
  transactionDescription(tx: any) {
    if (tx.mode !== 'demo') return tx.description;
    return ({ deposit: 'Nạp tiền', withdrawal: 'Rút tiền', transfer_out: 'Chuyển tiền', transfer_in: 'Nhận tiền' } as Record<string, string>)[tx.type] || tx.description;
  }
  isTierAdjustment(tx: any) { return tx.type === 'points_tier_adjustment'; }
}
