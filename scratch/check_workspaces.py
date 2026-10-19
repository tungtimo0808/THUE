import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

files = [
    'frontend/src/MisaPurchaseWorkspace.tsx',
    'frontend/src/MisaSalesWorkspace.tsx',
    'frontend/src/MisaInventoryWorkspace.tsx',
    'frontend/src/MisaToolsWorkspace.tsx',
    'frontend/src/MisaAssetsWorkspace.tsx',
    'frontend/src/MisaPayrollWorkspace.tsx',
    'frontend/src/MisaCostWorkspace.tsx',
    'frontend/src/MisaLedgerWorkspace.tsx'
]

for f in files:
    with open(f, 'r', encoding='utf-8') as fp:
        lines = fp.readlines()
    for idx, line in enumerate(lines, 1):
        if 'tab === "process"' in line or "tab === 'process'" in line or 'NGHIỆP VỤ' in line:
            print(f'=== {f} line {idx} ===')
            for sub in lines[max(0, idx-5):min(len(lines), idx+20)]:
                print(sub, end='')
            break
