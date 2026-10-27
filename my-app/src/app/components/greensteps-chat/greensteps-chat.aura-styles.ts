// Scoped to the pinned Aura 1.0.2 Shadow DOM; never injected into the page.
export const AURA_SURFACE_STYLES = `
  :host .header { padding: 18px 18px 14px; gap: 12px; }
  :host .header__left { gap: 10px; min-width: 0; }
  :host .header__btn { width: 30px; height: 30px; border-radius: 50%; }
  :host .header__actions { gap: 2px; }
  :host .empty-state { justify-content: flex-start; padding: 26px 22px 22px; }
  :host .empty-state__icon {
    display: block; width: 60px; height: 60px; margin: 0 0 19px;
    border-radius: 18px; background: #103e32 url('/images/greensteps-ai-mark.svg') center / 42px no-repeat;
    box-shadow: 0 6px 18px #103e3214;
  }
  :host .empty-state__icon md-icon { display: none; }
  :host .empty-state__heading { font-size: 29px; font-weight: 750; line-height: 1.22; letter-spacing: -1px; margin: 0 0 12px; color: #172d25; }
  :host .empty-state__heading::before { content: 'Chào bạn,'; display: block; color: #7b8780; font-weight: 550; margin-bottom: 3px; }
  :host .empty-state__desc { max-width: 290px; font-size: 13px; line-height: 1.7; color: #68766f; margin: 0 0 23px; }
  suggested-prompts { width: 100%; max-width: 340px; }
  suggested-prompts::part(suggested-prompts) { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; padding: 0; }
  suggested-prompts::part(prompt-chip) {
    width: 100%; max-width: none; min-width: 0; box-sizing: border-box;
    min-height: 48px; padding: 12px 10px; border-radius: 15px;
    border: 1px solid #ffffffd9; background: #ffffffc9;
    box-shadow: 0 2px 10px #173e2b05; justify-content: center;
    --aura-text-primary: #245344;
  }
  suggested-prompts::part(prompt-chip):hover { background: #fff; border-color: #a8cbb9; }
  suggested-prompts::part(prompt-chip):focus-visible { outline: 2px solid #0f766e; outline-offset: 2px; }
  aura-input { margin: 0 16px 8px; }
  aura-messages::part(message) { padding: 8px 16px; margin-bottom: 4px; gap: 0; }
  aura-messages::part(avatar) { display: none; }
  aura-messages::part(message-body) {
    background: var(--gs-bubble-bg, #f1f3f1); border: 1px solid var(--gs-bubble-border, #e9eeea); border-radius: 21px;
    padding: 13px 16px; color: var(--gs-bubble-ink, #24332c); font-size: 14px; line-height: 1.7; max-width: 100%;
  }
  aura-messages::part(message-user) { --gs-bubble-bg: #0f766e; --gs-bubble-ink: #fff; --gs-bubble-border: transparent; }
  :host(.has-planner-panel) aura-messages::part(transcript) { padding-bottom: 280px; }
  @media (max-width: 600px) {
    :host .header { padding: 16px 16px 12px; }
    :host .empty-state { padding: 20px 18px; }
    :host .empty-state__heading { font-size: 28px; }
  }
  @media (max-height: 650px) {
    :host .empty-state { padding-top: 16px; }
    :host .empty-state__icon { width: 48px; height: 48px; margin-bottom: 12px; background-size: 34px; }
    :host .empty-state__heading { font-size: 25px; }
  }
`;

export const AURA_COMPOSER_STYLES = `
  :host .input-area {
    box-sizing: border-box; display: flex; flex-direction: row; align-items: flex-end;
    gap: 10px; height: auto !important; min-height: 58px; padding: 10px 11px 10px 18px;
    border: 1px solid #e1e8e2; border-radius: 29px; background: #fff;
    box-shadow: 0 4px 20px #163b2910; color: #253c30;
  }
  :host .input-area:focus-within { border-color: #79ae9b; box-shadow: 0 0 0 3px #0f766e0d; }
  :host .resize-handle, :host .bottom-row_left { display: none; }
  :host .textarea-row { min-width: 0; min-height: 34px; }
  :host .chat-textarea { box-sizing: border-box; min-width: 0; height: 36px; min-height: 36px; padding: 7px 0; font-size: 14px; line-height: 22px; }
  :host .chat-textarea::placeholder { color: #828d85; }
  :host .bottom-row { padding: 0; flex: 0 0 auto; align-self: flex-end; }
  :host .send-btn { width: 36px; height: 36px; border-radius: 50%; background: #103e32; color: #fff; border: 0; }
  :host .send-btn:disabled { background: #e7eeea; color: #849a8b; }
  :host .send-btn:not(:disabled):hover { background: #0f766e; }
  :host [part='idea-button'], :host [part='skills-button'], :host [part='model-selector'] { display: none; }
  @media (max-width: 600px) { :host .chat-textarea { font-size: 16px; } }
`;
