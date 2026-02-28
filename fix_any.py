import re, glob, os

files = glob.glob('src/tests/main/ipc/*.integration.test.ts')
total_replacements = 0

for fpath in sorted(files):
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    count = [0]
    
    # Pattern: let mockXxx: any;
    def replace_let_any(m):
        count[0] += 1
        varname = m.group(1)
        return f'let {varname}: Record<string, ReturnType<typeof vi.fn>>;'
    content = re.sub(r'let (mock\w+): any;', replace_let_any, content)
    
    # Pattern: Record<string, any>
    n = content.count('Record<string, any>')
    content = content.replace('Record<string, any>', 'Record<string, unknown>')
    count[0] += n
    
    # Pattern: as any  (but NOT expect.any)
    # Replace `as any` with `as never` — safe for mock assignments in tests
    def replace_as_any(m):
        full_line = m.group(0)
        prefix = m.group(1)
        # Don't touch lines with expect.any
        return f'{prefix} as never'
    
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        if 'expect.any' in line:
            new_lines.append(line)
            continue
        if ' as any' in line:
            new_line = re.sub(r'(\S+)\s+as\s+any\b', r'\1 as never', line)
            if new_line != line:
                count[0] += line.count(' as any')
            new_lines.append(new_line)
        else:
            new_lines.append(line)
    content = '\n'.join(new_lines)
    
    # Pattern: Promise<any>
    n = content.count('Promise<any>')
    content = content.replace('Promise<any>', 'Promise<unknown>')
    count[0] += n
    
    # Pattern: Map<string, any>
    n = content.count('Map<string, any>')
    content = content.replace('Map<string, any>', 'Map<string, (...args: unknown[]) => Promise<unknown>>')
    count[0] += n
    
    # Pattern: () => any  (but not expect.any)
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        if 'expect.any' in line:
            new_lines.append(line)
            continue
        new_line = re.sub(r'\(\)\s*=>\s*any\b', '() => unknown', line)
        if new_line != line:
            count[0] += 1
        new_lines.append(new_line)
    content = '\n'.join(new_lines)
    
    # Pattern: (sender: any)
    n = content.count('sender: any)')
    content = content.replace('sender: any)', 'sender: unknown)')
    count[0] += n
    
    # Pattern: (payload: any)
    n = content.count('payload: any)')
    content = content.replace('payload: any)', 'payload: unknown)')
    count[0] += n
    
    # Pattern: (error: any) outside catch
    n = content.count('(error: any)')
    content = content.replace('(error: any)', '(error: unknown)')
    count[0] += n
    
    # Pattern: : any[]
    n = content.count(': any[]')
    content = content.replace(': any[]', ': unknown[]')
    count[0] += n
    
    # Pattern: as any[]
    old_count = len(re.findall(r'\bas any\[\]', content))
    content = re.sub(r'\bas any\[\]', 'as unknown[]', content)
    count[0] += old_count
    
    if content != original:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        basename = os.path.basename(fpath)
        print(f'{basename}: {count[0]} replacements')
        total_replacements += count[0]

print(f'\nTotal pass-2 replacements: {total_replacements}')
