// server/config.js — 所有配置集中管理，环境变量可覆盖
module.exports = {
  PORT: process.env.PORT || 3000,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'tsinglan_pe_secure_token_2026',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '123456',
  UPLOAD_MAX_SIZE: 200 * 1024 * 1024,
  FIELD_UPLOAD_MAX_SIZE: 5 * 1024 * 1024,
  PARKOUR_VIDEO_MAX_SIZE: 500 * 1024 * 1024
};
