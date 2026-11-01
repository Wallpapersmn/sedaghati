# مدل‌های سه‌بعدی

هر فایل `.glb` یا `.gltf` داخل این پوشه به‌صورت خودکار در کتابخانه سایت نمایش داده می‌شود.

## اضافه کردن مدل
1. فایل را اینجا کپی کنید.
2. یک‌بار لیست را به‌روز کنید:

```bash
# از ریشه پروژه:
python3 -c "
from pathlib import Path
f=Path('assets/models')
files=sorted(p.name for p in f.iterdir() if p.suffix.lower() in {'.glb','.gltf'})
(f/'list.js').write_text('window.SADEGHATI_MODELS = '+str(files).replace(\"'\",'\"')+';\n')
print(files)
"
```

یا فایل `list.js` را دستی ویرایش کنید تا نام فایل‌های جدید را داشته باشد.

> مرورگر به‌خاطر امنیت نمی‌تواند خودش محتویات پوشه را ببیند؛ به همین دلیل یک `list.js` سبک لازم است.
