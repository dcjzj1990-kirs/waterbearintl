#!/bin/bash
# WaterbearIntl 外贸独立站一键部署脚本
# 适用于 Ubuntu 20.04+/Debian 11+

set -e

echo "========================================="
echo " WaterbearIntl 外贸独立站部署脚本"
echo "========================================="

# 1. 检查系统
echo "[1/8] 检查系统环境..."
if [ "$EUID" -ne 0 ]; then 
  echo "请使用 sudo 运行此脚本"
  exit 1
fi

# 2. 安装 Node.js
echo "[2/8] 安装 Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 3. 安装 PM2
echo "[3/8] 安装 PM2 进程管理器..."
npm install -g pm2

# 4. 创建网站目录
echo "[4/8] 创建网站目录..."
WEB_DIR="/var/www/waterbearintl"
mkdir -p $WEB_DIR
mkdir -p $WEB_DIR/data
mkdir -p $WEB_DIR/uploads

# 5. 复制网站文件
echo "[5/8] 复制网站文件..."
# 假设文件已上传到当前目录
cp -r ./* $WEB_DIR/
cd $WEB_DIR

# 6. 安装依赖
echo "[6/8] 安装 Node.js 依赖..."
npm install express multer bcryptjs jsonwebtoken cors

# 7. 配置防火墙
echo "[7/8] 配置防火墙..."
if command -v ufw &> /dev/null; then
  ufw allow 22/tcp
  ufw allow 3000/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

# 8. 启动服务
echo "[8/8] 启动网站服务..."
pm2 start server.js --name waterbearintl
pm2 save
pm2 startup

echo ""
echo "========================================="
echo "✅ 部署完成！"
echo "========================================="
echo "网站目录: $WEB_DIR"
echo "服务状态: pm2 status waterbearintl"
echo "查看日志: pm2 logs waterbearintl"
echo "重启服务: pm2 restart waterbearintl"
echo "停止服务: pm2 stop waterbearintl"
echo ""
echo "🔗 访问地址:"
echo "  前端: http://你的服务器IP:3000"
echo "  后台: http://你的服务器IP:3000/admin.html"
echo "  默认账号: admin / admin123"
echo ""
echo "📝 后续步骤:"
echo "  1. 修改默认密码（登录后台 → 用户管理）"
echo "  2. 配置域名（修改 server.js 中的域名）"
echo "  3. 设置 HTTPS（使用 Let's Encrypt）"
echo "  4. 配置 Cloudflare CDN"
echo "========================================="