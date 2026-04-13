import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FileBrowserEntry, OperationResult } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function commandModuleUrl(name: string) {
  return new URL(`../dist/commands/${name}.js`, import.meta.url).href;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'SkillLink'
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for CLI commands
ipcMain.handle('skilllink:doctor', async () => {
  const { doctor } = await import(commandModuleUrl('doctor'));
  return doctor();
});

ipcMain.handle('skilllink:repoList', async () => {
  const repoModule = (await import(commandModuleUrl('repo'))) as unknown as { listReposData: () => Promise<unknown> };
  return repoModule.listReposData();
});

ipcMain.handle('skilllink:repoAdd', async (_event, url: string) => {
  const repoModule = (await import(commandModuleUrl('repo'))) as unknown as { repoAddData: (url: string) => Promise<OperationResult> };
  return repoModule.repoAddData(url);
});

ipcMain.handle('skilllink:repoRemove', async (_event, name: string, deleteFiles?: boolean) => {
  const repoModule = (await import(commandModuleUrl('repo'))) as unknown as { repoRemoveData: (name: string, deleteFiles?: boolean) => Promise<OperationResult> };
  return repoModule.repoRemoveData(name, deleteFiles);
});

ipcMain.handle('skilllink:repoSync', async () => {
  const repoModule = (await import(commandModuleUrl('repo'))) as unknown as { repoSyncData: () => Promise<OperationResult> };
  return repoModule.repoSyncData();
});

ipcMain.handle('skilllink:skillList', async () => {
  const skillModule = (await import(commandModuleUrl('skill'))) as unknown as { listSkillsData: () => Promise<unknown> };
  return skillModule.listSkillsData();
});

ipcMain.handle('skilllink:skillDiscover', async () => {
  const skillModule = (await import(commandModuleUrl('skill'))) as unknown as { skillDiscoverData: () => Promise<OperationResult> };
  return skillModule.skillDiscoverData();
});

ipcMain.handle('skilllink:linkList', async (_event, skillName?: string) => {
  const linkModule = (await import(commandModuleUrl('link'))) as unknown as { listLinksData: (skillName?: string) => Promise<unknown> };
  return linkModule.listLinksData(skillName);
});

ipcMain.handle('skilllink:linkSync', async () => {
  const linkModule = (await import(commandModuleUrl('link'))) as unknown as { linkSyncData: () => Promise<OperationResult> };
  return linkModule.linkSyncData();
});

ipcMain.handle('skilllink:fileList', async (_event, repoPath: string, dirPath?: string) => {
  const rootPath = await fs.realpath(repoPath);
  const requestedPath = await fs.realpath(dirPath || repoPath);
  const relative = path.relative(rootPath, requestedPath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path is outside the selected repository.');
  }

  const entries = await fs.readdir(requestedPath, { withFileTypes: true });
  const results = await Promise.all(entries.map(async (entry): Promise<FileBrowserEntry> => {
    const entryPath = path.join(requestedPath, entry.name);
    let hasSKILLMd = false;
    let skillName: string | undefined;
    let skillPath: string | undefined;

    if (entry.isDirectory()) {
      try {
        await fs.access(path.join(entryPath, 'SKILL.md'));
        hasSKILLMd = true;
        skillName = entry.name;
        skillPath = entryPath;
      } catch {
        hasSKILLMd = false;
      }
    }

    return {
      name: entry.name,
      path: entryPath,
      isDirectory: entry.isDirectory(),
      hasSKILLMd,
      skillName,
      skillPath
    };
  }));

  return results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
});

ipcMain.handle('skilllink:linkCreate', async (_event, skillName: string, targetDir?: string) => {
  const { linkCreateData } = (await import(commandModuleUrl('link'))) as unknown as { linkCreateData: (skillName: string, targetDir?: string) => Promise<OperationResult> };
  return linkCreateData(skillName, targetDir);
});

ipcMain.handle('skilllink:linkRemove', async (_event, skillName: string, targetPath?: string) => {
  const { linkRemoveData } = (await import(commandModuleUrl('link'))) as unknown as { linkRemoveData: (skillName: string, targetPath?: string) => Promise<OperationResult> };
  return linkRemoveData(skillName, targetPath);
});

ipcMain.handle('skilllink:linkUpdate', async (_event, skillName: string, newTarget: string, oldTarget?: string) => {
  const { linkUpdateData } = (await import(commandModuleUrl('link'))) as unknown as { linkUpdateData: (skillName: string, newTarget: string, oldTarget?: string) => Promise<OperationResult> };
  return linkUpdateData(skillName, newTarget, oldTarget);
});

ipcMain.handle('skilllink:branchList', async (_event, repoName?: string) => {
  const branchModule = (await import(commandModuleUrl('branch'))) as unknown as { branchListData: (repoName?: string) => Promise<OperationResult> };
  return branchModule.branchListData(repoName);
});

ipcMain.handle('skilllink:branchSwitch', async (_event, branchName: string, repoName?: string) => {
  const branchModule = (await import(commandModuleUrl('branch'))) as unknown as { branchSwitchData: (branchName: string, repoName?: string) => Promise<OperationResult> };
  return branchModule.branchSwitchData(branchName, repoName);
});

ipcMain.handle('skilllink:branchCreate', async (_event, branchName: string, repoName?: string) => {
  const branchModule = (await import(commandModuleUrl('branch'))) as unknown as { branchCreateData: (branchName: string, repoName?: string) => Promise<OperationResult> };
  return branchModule.branchCreateData(branchName, repoName);
});

ipcMain.handle('skilllink:configGet', async () => {
  const configModule = (await import(commandModuleUrl('config'))) as unknown as { configData: () => Promise<unknown> };
  return configModule.configData();
});

ipcMain.handle('skilllink:configSet', async (_event, key: string, value: string) => {
  const configModule = (await import(commandModuleUrl('config'))) as unknown as { configSet: (key: string, value: string) => Promise<void> };
  return configModule.configSet(key, value);
});
