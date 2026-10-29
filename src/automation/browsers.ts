import { existsSync } from 'node:fs';
import path from 'node:path';

export interface BrowserInfo { id: 'chrome' | 'edge' | 'firefox' | 'brave' | 'chromium' | 'vivaldi' | 'opera'; label: string; path: string }

function firstExisting(paths: (string | undefined)[]): string | undefined {
  return paths.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));
}

export function detectInstalledBrowsers(): BrowserInfo[] {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  const local = process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
  const candidates: BrowserInfo[] = process.platform === 'win32' ? [
    { id: 'chrome', label: 'Google Chrome', path: firstExisting([path.join(programFiles, 'Google/Chrome/Application/chrome.exe'), path.join(programFilesX86, 'Google/Chrome/Application/chrome.exe'), path.join(local, 'Google/Chrome/Application/chrome.exe')]) ?? '' },
    { id: 'edge', label: 'Microsoft Edge', path: firstExisting([path.join(programFiles, 'Microsoft/Edge/Application/msedge.exe'), path.join(programFilesX86, 'Microsoft/Edge/Application/msedge.exe'), path.join(local, 'Microsoft/Edge/Application/msedge.exe')]) ?? '' },
    { id: 'brave', label: 'Brave', path: firstExisting([path.join(programFiles, 'BraveSoftware/Brave-Browser/Application/brave.exe'), path.join(programFilesX86, 'BraveSoftware/Brave-Browser/Application/brave.exe'), path.join(local, 'BraveSoftware/Brave-Browser/Application/brave.exe')]) ?? '' },
    { id: 'firefox', label: 'Mozilla Firefox', path: firstExisting([path.join(programFiles, 'Mozilla Firefox/firefox.exe'), path.join(programFilesX86, 'Mozilla Firefox/firefox.exe'), path.join(local, 'Mozilla Firefox/firefox.exe')]) ?? '' },
    { id: 'vivaldi', label: 'Vivaldi', path: firstExisting([path.join(programFiles, 'Vivaldi/Application/vivaldi.exe'), path.join(local, 'Vivaldi/Application/vivaldi.exe')]) ?? '' },
    { id: 'opera', label: 'Opera', path: firstExisting([path.join(local, 'Programs/Opera/opera.exe'), path.join(programFiles, 'Opera/opera.exe'), path.join(programFilesX86, 'Opera/opera.exe')]) ?? '' },
    { id: 'chromium', label: 'Chromium', path: firstExisting([path.join(programFiles, 'Chromium/Application/chrome.exe'), path.join(local, 'Chromium/Application/chrome.exe')]) ?? '' },
  ] : process.platform === 'darwin' ? [
    { id: 'chrome', label: 'Google Chrome', path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
    { id: 'edge', label: 'Microsoft Edge', path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
    { id: 'brave', label: 'Brave', path: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' },
    { id: 'firefox', label: 'Mozilla Firefox', path: '/Applications/Firefox.app/Contents/MacOS/firefox' },
    { id: 'vivaldi', label: 'Vivaldi', path: '/Applications/Vivaldi.app/Contents/MacOS/Vivaldi' },
    { id: 'opera', label: 'Opera', path: '/Applications/Opera.app/Contents/MacOS/Opera' },
    { id: 'chromium', label: 'Chromium', path: '/Applications/Chromium.app/Contents/MacOS/Chromium' },
  ] : [
    { id: 'chrome', label: 'Google Chrome', path: firstExisting(['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/snap/bin/chromium']) ?? '' },
    { id: 'edge', label: 'Microsoft Edge', path: firstExisting(['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable']) ?? '' },
    { id: 'brave', label: 'Brave', path: firstExisting(['/usr/bin/brave-browser', '/usr/bin/brave']) ?? '' },
    { id: 'firefox', label: 'Mozilla Firefox', path: firstExisting(['/usr/bin/firefox', '/snap/bin/firefox']) ?? '' },
    { id: 'vivaldi', label: 'Vivaldi', path: firstExisting(['/usr/bin/vivaldi', '/usr/bin/vivaldi-stable']) ?? '' },
    { id: 'opera', label: 'Opera', path: firstExisting(['/usr/bin/opera', '/usr/bin/opera-stable']) ?? '' },
    { id: 'chromium', label: 'Chromium', path: firstExisting(['/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium']) ?? '' },
  ];
  return candidates.filter((browser) => browser.path && existsSync(browser.path));
}
