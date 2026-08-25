import { browser } from 'wxt/browser';
import { mountUrlSettingsForm } from '../../src/url-settings-form.js';

const mount = document.querySelector<HTMLElement>('#url-settings-mount');
if (mount) {
  mountUrlSettingsForm(mount, { compact: true });
}

const openOptionsButton = document.querySelector<HTMLButtonElement>('#open-options');
openOptionsButton?.addEventListener('click', function handleOpenOptions(): void {
  void browser.runtime.openOptionsPage();
});
