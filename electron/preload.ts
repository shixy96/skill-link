import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('skilllink', {
  doctor: () => ipcRenderer.invoke('skilllink:doctor'),
  repoList: () => ipcRenderer.invoke('skilllink:repoList'),
  repoAdd: (url: string) => ipcRenderer.invoke('skilllink:repoAdd', url),
  repoRemove: (name: string, deleteFiles?: boolean) => ipcRenderer.invoke('skilllink:repoRemove', name, deleteFiles),
  repoSync: () => ipcRenderer.invoke('skilllink:repoSync'),
  skillList: () => ipcRenderer.invoke('skilllink:skillList'),
  skillDiscover: () => ipcRenderer.invoke('skilllink:skillDiscover'),
  linkList: (skillName?: string) => ipcRenderer.invoke('skilllink:linkList', skillName),
  linkSync: () => ipcRenderer.invoke('skilllink:linkSync'),
  fileList: (repoPath: string, dirPath?: string) => ipcRenderer.invoke('skilllink:fileList', repoPath, dirPath),
  linkCreate: (skillName: string, targetDir?: string) => ipcRenderer.invoke('skilllink:linkCreate', skillName, targetDir),
  linkRemove: (skillName: string, targetPath?: string) => ipcRenderer.invoke('skilllink:linkRemove', skillName, targetPath),
  linkUpdate: (skillName: string, newTarget: string, oldTarget?: string) => ipcRenderer.invoke('skilllink:linkUpdate', skillName, newTarget, oldTarget),
  branchList: (repoName?: string) => ipcRenderer.invoke('skilllink:branchList', repoName),
  branchSwitch: (branchName: string, repoName?: string) => ipcRenderer.invoke('skilllink:branchSwitch', branchName, repoName),
  branchCreate: (branchName: string, repoName?: string) => ipcRenderer.invoke('skilllink:branchCreate', branchName, repoName),
  configGet: () => ipcRenderer.invoke('skilllink:configGet'),
  configSet: (key: string, value: string) => ipcRenderer.invoke('skilllink:configSet', key, value)
});
