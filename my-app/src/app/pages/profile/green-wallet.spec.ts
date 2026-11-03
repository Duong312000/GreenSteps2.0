// @vitest-environment jsdom
import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { GreenWalletComponent } from './green-wallet';

describe('GreenWalletComponent', () => {
  it('confirms the owner sandbox request and reloads its settled balance', async () => {
    const tx = { id: 'own-sandbox', mode: 'demo', status: 'SUCCESS', amount: 50000 };
    const api = { walletRequest: vi.fn().mockResolvedValueOnce({ transaction: tx }).mockResolvedValueOnce({ demo: { available_balance: 50000 } }).mockResolvedValueOnce({ transaction: tx, ledger: [] }) };
    const component = new GreenWalletComponent(api as any, { markForCheck: vi.fn() } as any);
    component.selectedTransaction = { ...tx, status: 'PENDING' }; component.demoModal = 'demoDetail';
    await component.simulateDemo('SUCCESS');
    expect(api.walletRequest.mock.calls[0]).toEqual(['POST', '/demo/transactions/own-sandbox/simulate', { status: 'SUCCESS' }]);
    expect(component.demoAvailable).toBe(50000); expect(component.selectedTransaction.status).toBe('SUCCESS');
  });
  it('clears the connection error when retry successfully loads the wallet', async () => {
    const state = { wallet: { green_points: 100 }, transactions: [] };
    const api = { walletRequest: vi.fn().mockRejectedValueOnce({ status: 0 }).mockResolvedValueOnce(state) };
    const component = new GreenWalletComponent(api as any, { markForCheck: vi.fn() } as any);
    await component.refresh(); expect(component.error).toContain('máy chủ');
    await component.refresh(); expect(component.error).toBe(''); expect(component.data).toBe(state);
  });
  it('refreshes the wallet after redeeming and shows the server voucher code', async () => {
    const overview = { wallet: { green_points: 1200 }, transactions: [], membership: { points: 500, next: { threshold: 5000 } } };
    const api = { walletRequest: vi.fn().mockResolvedValueOnce({ code: 'GREEN-SERVER' }).mockResolvedValueOnce(overview) };
    const component = new GreenWalletComponent(api as any, { markForCheck: vi.fn() } as any);
    component.open('redeem'); component.points = 1000;
    await component.submit();
    expect(api.walletRequest.mock.calls[0].slice(0, 2)).toEqual(['POST', '/points/redeem']);
    expect(component.data).toBe(overview);
    expect(component.notice).toContain('GREEN-SERVER'); expect(component.modal).toBe('');
    expect(component.progress).toBe(10);
  });
  it('keeps the idempotency key and form after a failed request so retry cannot double debit', async () => {
    const api = { walletRequest: vi.fn().mockRejectedValue({ error: { message: 'Không đủ điểm' } }) };
    const component = new GreenWalletComponent(api as any, { markForCheck: vi.fn() } as any);
    component.open('transfer'); await component.submit(); await component.submit();
    expect(api.walletRequest.mock.calls[0][3]).toBe(api.walletRequest.mock.calls[1][3]);
    expect(component.modal).toBe('transfer'); expect(component.error).toBe('Không đủ điểm'); expect(component.busy).toBe(false);
  });
  it('reads a QR as a transfer proposal and requires a separate confirmation', async () => {
    const api = { walletRequest: vi.fn() };
    const component = new GreenWalletComponent(api as any, { markForCheck: vi.fn() } as any);
    component.open('qr'); component.qrText = 'greensteps://points?email=friend@example.com';
    await component.submit();
    expect(component.modal).toBe('transfer'); expect(component.email).toBe('friend@example.com'); expect(api.walletRequest).not.toHaveBeenCalled();
  });
  it('requires review before creating a pending demo deposit and never credits the client balance', async () => {
    const state = { demo: { account_enabled: true, available_balance: 0, held: 0, banks: [] }, transactions: [] };
    const tx = { id: 'demo-deposit', mode: 'demo', status: 'PENDING', amount: 50000 };
    const api = { walletRequest: vi.fn().mockResolvedValueOnce({ transaction: tx }).mockResolvedValueOnce(state).mockResolvedValueOnce({ transaction: tx, ledger: [] }) };
    const component = new GreenWalletComponent(api as any, { markForCheck: vi.fn() } as any);
    component.data = state; component.open('deposit'); component.prepareDemo();
    expect(component.demoModal).toBe('deposit'); expect(component.demoStep).toBe('review'); expect(api.walletRequest).not.toHaveBeenCalled();
    await component.commitDemo();
    expect(api.walletRequest.mock.calls[0].slice(0, 3)).toEqual(['POST', '/demo/deposits', { amount: 50000, method: 'demo_bank' }]);
    expect(component.demoAvailable).toBe(0); expect(component.selectedTransaction.status).toBe('PENDING'); expect(component.demoModal).toBe('demoDetail');
  });
  it('blocks withdrawals over available funds and money transfers without a verified recipient', () => {
    const api = { walletRequest: vi.fn() };
    const component = new GreenWalletComponent(api as any, { markForCheck: vi.fn() } as any);
    component.data = { demo: { account_enabled: true, available_balance: 10000, banks: [{ id: 'bank-demo' }] } };
    component.open('withdraw'); component.amount = 50000; component.prepareDemo();
    expect(component.demoStep).toBe('edit'); expect(component.error).toContain('khả dụng');
    component.open('moneyTransfer'); component.amount = 10000; component.prepareDemo();
    expect(component.demoStep).toBe('edit'); expect(component.error).toContain('người nhận'); expect(api.walletRequest).not.toHaveBeenCalled();
  });
  it('reuses the demo idempotency key after a lost response and retains the confirmation payload', async () => {
    const api = { walletRequest: vi.fn().mockRejectedValue(new Error('network unavailable')) };
    const component = new GreenWalletComponent(api as any, { markForCheck: vi.fn() } as any);
    component.data = { demo: { account_enabled: true, available_balance: 0 } }; component.open('deposit'); component.prepareDemo();
    await component.commitDemo(); await component.commitDemo();
    expect(api.walletRequest.mock.calls[0][3]).toBe(api.walletRequest.mock.calls[1][3]); expect(component.demoStep).toBe('review'); expect(component.demoPayload.amount).toBe(50000);
  });
});
