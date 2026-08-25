import { mountUrlSettingsForm } from '../../src/url-settings-form.js';

const mount = document.querySelector<HTMLElement>('#url-settings-mount');
if (mount) {
  mountUrlSettingsForm(mount);
}
