# WaterbearIntl 外贸独立站部署指南

## 项目结构
```
waterbearintl/
├── index.html          # 首页
├── about.html          # 关于我们
├── products.html       # 产品展示
├── services.html       # 服务
├── contact.html        # 联系我们
├── blog.html           # 博客
├── admin.html          # 后台管理系统
├── server.js           # Node.js 后端 API
├── package.json        # 依赖配置
├── data/               # 数据存储目录
│   ├── products.json   # 产品数据
│   ├── messages.json   # 客户消息
│   ├── users.json      # 用户数据
│   ├── settings.json   # 网站设置
│   ├── images.json     # 图片元数据
│   └── logs.json       # 操作日志
├── uploads/            # 上传文件目录
└── deploy.sh           # 一键部署脚本
```

## 部署步骤

### 1. 购买服务器（推荐）
- **DigitalOcean**: $5/月，1GB RAM，25GB SSD
- **Vultr**: $6/月，1GB RAM，25GB SSD
- **阿里云国际版**: $4.5/月，1GB RAM，40GB SSD

### 2. 连接服务器
```bash
ssh root@你的服务器IP
```

### 3. 上传网站文件
```bash
# 在本地电脑执行
scp -r C:\Users\dcjzj\AppData\Roaming\Tencent\Marvis\User\oAN1i2XLs3bUJn699KkzYXpdh53Y\workspace\conv_19e69a342c0_84ffc0b89fd8\output\外贸独立站\* root@你的服务器IP:/root/waterbearintl/
```

### 4. 运行部署脚本
```bash
cd /root/waterbearintl
chmod +x deploy.sh
sudo ./deploy.sh
```

### 5. 配置域名
```bash
# 编辑 server.js 修改域名
nano /var/www/waterbearintl/server.js
# 修改第 10 行：const PORT = process.env.PORT || 3000;
```

### 6. 设置 HTTPS（可选但推荐）
```bash
# 安装 Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot certonly --standalone -d 你的域名.com -d www.你的域名.com

# 自动续期
sudo certbot renew --dry-run
```

## 后台管理
- **地址**: http://你的域名.com/admin.html
- **默认账号**: admin / admin123
- **首次登录后请修改密码**

## 维护命令

### 查看服务状态
```bash
pm2 status waterbearintl
```

### 查看实时日志
```bash
pm2 logs waterbearintl
```

### 重启服务
```bash
pm2 restart waterbearintl
```

### 停止服务
```bash
pm2 stop waterbearintl
```

### 备份数据
```bash
# 手动备份
tar -czf backup_$(date +%Y%m%d).tar.gz /var/www/waterbearintl/data/

# 自动备份（添加到 crontab）
0 2 * * * tar -czf /backup/waterbearintl_$(date +\%Y\%m\%d).tar.gz /var/www/waterbearintl/data/
```

## 故障排除

### 端口 3000 无法访问
```bash
# 检查防火墙
sudo ufw status
sudo ufw allow 3000/tcp

# 检查服务是否运行
pm2 list
netstat -tlnp | grep 3000
```

### 上传图片失败
```bash
# 检查 uploads 目录权限
sudo chown -R www-data:www-data /var/www/waterbearintl/uploads
sudo chmod -R 755 /var/www/waterbearintl/uploads
```

### 内存不足
```bash
# 查看内存使用
free -h

# 优化 Node.js 内存
pm2 restart waterbearintl --max-memory-restart 300M
```

## 性能优化建议

### 1. 启用 Gzip 压缩
```javascript
// 在 server.js 中添加
const compression = require('compression');
app.use(compression());
```

### 2. 静态文件缓存
```javascript
// 在 server.js 中添加
app.use(express.static(__dirname, {
  maxAge: '1d',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));
```

### 3. 数据库迁移（当数据量大时）
考虑迁移到 MySQL 或 PostgreSQL：
```bash
# 安装 MySQL
sudo apt install mysql-server
# 创建数据库和用户
# 修改 server.js 使用 mysql2 驱动
```

## 联系支持
如有问题，请检查：
1. 服务器日志：`pm2 logs waterbearintl`
2. 浏览器控制台错误
3. 网络连接状态

## 安全提醒
✅ 已完成：
- 密码加密存储（bcrypt）
- JWT 令牌认证
- 文件上传类型限制
- SQL 注入防护

⚠️ 建议补充：
- 定期更新 Node.js 依赖
- 设置强密码策略
- 启用登录失败限制
- 配置 WAF（Web 应用防火墙）