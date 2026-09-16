"""Package tested static site and allowlisted sources, never runtime profiles/data."""
from pathlib import Path
import hashlib
import json
import shutil
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
destination = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'release/web-final'
folders = ['web', 'src', 'electron', 'public', 'scripts', 'tests', 'docs', 'design']
files = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.gitignore', 'LICENSE', 'README.md', 'README_WEB.md', 'ROADMAP.md', 'TEST_REPORT.md']
for folder in folders:
    assert destination != root / folder and root / folder not in destination.parents, 'Destination inside a source directory'
assert destination != root, 'Use a dedicated output directory'
assert (root / 'web-dist/index.html').is_file(), 'Build first'
assert '__parking' not in (root / 'web-dist/game.js').read_text(encoding='utf-8'), 'Production contains test hooks'
for suite, count in [('lane', 13), ('tutorial', 13), ('shift', 12), ('release', 12), ('browsers', 2)]:
    report = json.loads((root / f'output/playwright/{suite}/report.json').read_text(encoding='utf-8'))
    assert report['status'] == 'PASS' and len(report['checks']) == count, f'{suite} tests incomplete'
assert json.loads((root / 'output/balance/shift-report.json').read_text(encoding='utf-8'))['status'] == 'PASS'
forbidden = {'node_modules', 'output', 'test-output', 'web-test', '.git', '.profile', 'profile', 'sessions', 'release', '__pycache__'}
def safe(relative):
    assert not any(part in forbidden for part in relative.parts), relative
    assert not (relative.name.startswith('leaderboard') and (relative.suffix == '.json' or '.corrupt' in relative.name)) and relative.suffix not in ['.log', '.tmp', '.exe'], relative

copied = []
def copy(source, relative):
    safe(relative)
    target = destination / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    assert source.read_bytes() == target.read_bytes()
    copied.append(relative)

for source in sorted((root / 'web-dist').rglob('*')):
    if source.is_file():
        relative = source.relative_to(root / 'web-dist')
        copy(source, Path('site') / relative)
        copy(source, Path('source/web-dist') / relative)
copy(root / 'LICENSE', Path('site/LICENSE'))
for folder in folders:
    for source in sorted((root / folder).rglob('*')):
        if source.is_file() and not any(p in forbidden for p in source.relative_to(root).parts):
            copy(source, Path('source') / source.relative_to(root))
for name in files:
    if (root / name).is_file():
        copy(root / name, Path('source') / name)
copy(root / 'docs/WEB_RELEASE.md', Path('README.md'))
copy(root / 'ROADMAP.md', Path('ROADMAP.md'))
for name in ['WEB_RELEASE.md', 'RELEASE_REPORT.md', 'PLAYTEST_HANDOFF.md']:
    copy(root / 'docs' / name, Path('docs') / name)

archives = []
for name, entries in [
    ('ParkingManager-web-final.zip', [(p, p.as_posix()) for p in copied]),
    ('ParkingManager-GitHub-Pages.zip', [(p, p.relative_to('site').as_posix()) for p in copied if p.parts[0] == 'site']),
]:
    archive = destination.parent / name
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for relative, member in entries:
            z.write(destination / relative, member)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        for relative, member in entries:
            safe(Path(member))
            assert z.read(member) == (destination / relative).read_bytes()
        assert not any('__parking' in z.read(n).decode('utf-8') for n in z.namelist() if n.endswith('/game.js') or n == 'game.js')
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n', encoding='utf-8')
    archives.append({'file': str(archive), 'bytes': archive.stat().st_size, 'files': len(entries), 'sha256': digest})
manifest = {'status': 'PASS', 'data_policy': 'allowlisted source and static files only; no profiles, sessions, records, logs or test outputs', 'archives': archives}
(destination / 'PACKAGE_REPORT.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(manifest, ensure_ascii=False, indent=2))
