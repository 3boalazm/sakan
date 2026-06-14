#!/bin/bash
# ====================================================
# سكن TWA — بناء APK بدون Android Studio
# ====================================================
# المتطلبات:
#   1. Node.js 18+
#   2. Java 17+  (temurin recommended)
#
# تشغيل:
#   chmod +x build-twa.sh
#   ./build-twa.sh
# ====================================================

set -e

echo "🌿 سكن — بناء TWA APK"
echo "========================"

# 1. Install bubblewrap
echo "📦 تثبيت Bubblewrap..."
npm install -g @bubblewrap/cli

# 2. Initialize TWA project from manifest
echo "🔧 إنشاء مشروع TWA..."
bubblewrap init --manifest=https://sakan-md.vercel.app/manifest.json

# 3. Build debug APK (للتجربة)
echo "🔨 بناء APK..."
bubblewrap build

echo ""
echo "✅ اكتمل البناء!"
echo "📱 APK موجود في: ./app-release-signed.apk"
echo ""
echo "📤 لتثبيته مباشرةً على الموبايل:"
echo "   adb install app-release-signed.apk"
