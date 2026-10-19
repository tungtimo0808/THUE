import re

sales_file = 'frontend/src/MisaSalesWorkspace.tsx'
with open(sales_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Add missing lucide icons to import
lucide_import_pattern = r'import \{([^}]+)\} from "lucide-react";'
m = re.search(lucide_import_pattern, content)
if m:
    existing_imports = m.group(1)
    new_icons = ["Coins", "FileText", "FileCheck", "Check", "RotateCcw", "Percent", "ArrowRight"]
    to_add = [icon for icon in new_icons if icon not in existing_imports]
    if to_add:
        replacement = f'import {{{existing_imports.rstrip()}\n  ' + ',\n  '.join(to_add) + ',\n} from "lucide-react";'
        content = content[:m.start()] + replacement + content[m.end():]

with open(sales_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Lucide icons added to MisaSalesWorkspace.tsx")
