import re

file_path = 'frontend/src/MisaPurchaseWorkspace.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'import \{([^}]+)\} from "lucide-react";', content)
if m:
    existing = m.group(1)
    needed = ["ShoppingCart", "Coins", "RotateCcw", "Percent", "ShieldCheck"]
    to_add = [icon for icon in needed if icon not in existing]
    if to_add:
        replacement = f'import {{{existing.rstrip()}\n  ' + ',\n  '.join(to_add) + ',\n} from "lucide-react";'
        content = content[:m.start()] + replacement + content[m.end():]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Purchase imports")
