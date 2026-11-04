(() => {
  'use strict';
  const cards = {
    douyin: { platform: '抖音', account: '4503068', image: './assets/social-douyin.jpg' },
    xiaohongshu: { platform: '小红书', account: '957972693', image: './assets/social-xiaohongshu.jpg' }
  };
  const dialog = document.getElementById('social-dialog');
  const status = document.getElementById('social-copy-status');
  let active = null;
  document.getElementById('wechat-copy').addEventListener('click', async () => {
    const copyStatus = document.getElementById('wechat-copy-status');
    try {
      await navigator.clipboard.writeText('soulvisa599');
      copyStatus.textContent = '微信号已复制。';
    } catch {
      copyStatus.textContent = '微信号：soulvisa599，可手动复制。';
    }
  });
  document.querySelectorAll('[data-social-card]').forEach(button => {
    button.addEventListener('click', () => {
      active = cards[button.dataset.socialCard];
      if (!active) return;
      document.getElementById('social-title').textContent = `李奥 SOULVISA · ${active.platform}`;
      document.getElementById('social-account').textContent = `${active.platform}号：${active.account}`;
      const image = document.getElementById('social-image');
      image.src = active.image;
      image.alt = `李奥 SOULVISA 的${active.platform}名片原图`;
      const save = document.getElementById('social-save');
      save.href = active.image;
      save.download = `李奥SOULVISA-${active.platform}名片.jpg`;
      status.textContent = '';
      dialog.showModal();
    });
  });
  document.getElementById('social-copy').addEventListener('click', async () => {
    if (!active) return;
    const current = active;
    try {
      await navigator.clipboard.writeText(current.account);
      if (active === current) status.textContent = '账号已复制。';
    } catch {
      if (active === current) status.textContent = `可手动复制账号：${current.account}`;
    }
  });
})();
