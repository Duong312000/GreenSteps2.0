import { SupportChatLauncherService } from '../../services/support-chat-launcher.service';
import { HelpCenterContactComponent } from './contact';

describe('HelpCenterContactComponent', () => {
  it('requests opening the existing chat after the contact button click finishes bubbling', async () => {
    const launcher = new SupportChatLauncherService();
    let clickIsBubbling = true;
    const opened = vi.fn(() => expect(clickIsBubbling).toBe(false));
    launcher.openRequested$.subscribe(opened);
    const component = new HelpCenterContactComponent(launcher);
    component.openChat();
    expect(opened).not.toHaveBeenCalled();
    await Promise.resolve();
    clickIsBubbling = false;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(opened).toHaveBeenCalledOnce();
  });
});
