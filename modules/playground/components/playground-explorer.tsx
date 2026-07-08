"use client";

import * as React from "react";
import {
  ChevronRight,
  File,
  Folder,
  Plus,
  FilePlus,
  FolderPlus,
  MoreHorizontal,
  Trash2,
  Edit3,
  RotateCw,
  FileJson,
  FileCode,
  FileText,
  BookOpen,
  FolderClosed,
  FolderOpen,
  Terminal,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";

import RenameFolderDialog from "./dialogs/rename-folder-dialog";
import NewFolderDialog from "./dialogs/new-folder-dialog";
import NewFileDialog from "./dialogs/new-file-dialog";
import RenameFileDialog from "./dialogs/rename-file-dialog";
import { DeleteDialog } from "./dialogs/delete-dialog";

interface TemplateFile {
  filename: string;
  fileExtension: string;
  content: string;
  id?: string;
}

interface TemplateFolder {
  folderName: string;
  items: (TemplateFile | TemplateFolder)[];
}

type TemplateItem = TemplateFile | TemplateFolder;

interface TemplateFileTreeProps {
  data: TemplateItem;
  instance?: any; // WebContainer instance
  onFileSelect?: (file: TemplateFile) => void;
  selectedFile?: TemplateFile;
  title?: string;
  onAddFile?: (file: TemplateFile, parentPath: string) => void;
  onAddFolder?: (folder: TemplateFolder, parentPath: string) => void;
  onDeleteFile?: (file: TemplateFile, parentPath: string) => void;
  onDeleteFolder?: (folder: TemplateFolder, parentPath: string) => void;
  onRenameFile?: (
    file: TemplateFile,
    newFilename: string,
    newExtension: string,
    parentPath: string
  ) => void;
  onRenameFolder?: (
    folder: TemplateFolder,
    newFolderName: string,
    parentPath: string
  ) => void;
  onSync?: () => void;
}

// File Icon helper mapping Extensions to beautiful VS Code style colored icons
function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return <FileJson className="h-4 w-4 mr-2 shrink-0 text-amber-500" />;
    case 'js':
    case 'mjs':
    case 'cjs':
      return <FileCode className="h-4 w-4 mr-2 shrink-0 text-yellow-500" />;
    case 'ts':
      return <FileCode className="h-4 w-4 mr-2 shrink-0 text-blue-500" />;
    case 'tsx':
      return <FileCode className="h-4 w-4 mr-2 shrink-0 text-sky-400" />;
    case 'css':
      return <FileText className="h-4 w-4 mr-2 shrink-0 text-pink-400" />;
    case 'html':
      return <FileCode className="h-4 w-4 mr-2 shrink-0 text-orange-500" />;
    case 'md':
      return <BookOpen className="h-4 w-4 mr-2 shrink-0 text-emerald-500" />;
    case 'sh':
    case 'bat':
      return <Terminal className="h-4 w-4 mr-2 shrink-0 text-zinc-400" />;
    default:
      return <File className="h-4 w-4 mr-2 shrink-0 text-zinc-400" />;
  }
}

export function TemplateFileTree({
  data,
  instance,
  onFileSelect,
  selectedFile,
  title = "Files Explorer",
  onAddFile,
  onAddFolder,
  onDeleteFile,
  onDeleteFolder,
  onRenameFile,
  onRenameFolder,
  onSync,
}: TemplateFileTreeProps) {
  const isRootFolder = data && typeof data === "object" && "folderName" in data;
  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = React.useState(false);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] =
    React.useState(false);

  const handleAddRootFile = () => {
    setIsNewFileDialogOpen(true);
  };

  const handleAddRootFolder = () => {
    setIsNewFolderDialogOpen(true);
  };

  const handleCreateFile = (filename: string, extension: string) => {
    if (onAddFile && isRootFolder) {
      const newFile: TemplateFile = {
        filename,
        fileExtension: extension,
        content: "",
      };
      onAddFile(newFile, "");
    }
    setIsNewFileDialogOpen(false);
  };

  const handleCreateFolder = (folderName: string) => {
    if (onAddFolder && isRootFolder) {
      const newFolder: TemplateFolder = {
        folderName,
        items: [],
      };
      onAddFolder(newFolder, "");
    }
    setIsNewFolderDialogOpen(false);
  };

  // If container instance is active, render using lazy-loading sandbox crawler!
  if (instance) {
    return (
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{title}</SidebarGroupLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarGroupAction>
                  <Plus className="h-4 w-4" />
                </SidebarGroupAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onSync && (
                  <>
                    <DropdownMenuItem onClick={onSync}>
                      <RotateCw className="h-4 w-4 mr-2 text-blue-500" />
                      Sync Files from Sandbox
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleAddRootFile}>
                  <FilePlus className="h-4 w-4 mr-2" />
                  New File
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddRootFolder}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <SidebarGroupContent>
              <SidebarMenu>
                <SandboxFolderNode
                  name=""
                  path=""
                  instance={instance}
                  level={0}
                  onFileSelect={onFileSelect}
                  selectedFile={selectedFile}
                  onAddFile={onAddFile}
                  onAddFolder={onAddFolder}
                  onDeleteFile={onDeleteFile}
                  onDeleteFolder={onDeleteFolder}
                  onRenameFile={onRenameFile}
                  onRenameFolder={onRenameFolder}
                  onSync={onSync}
                  isRoot={true}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />

        <NewFileDialog
          isOpen={isNewFileDialogOpen}
          onClose={() => setIsNewFileDialogOpen(false)}
          onCreateFile={handleCreateFile}
        />

        <NewFolderDialog
          isOpen={isNewFolderDialogOpen}
          onClose={() => setIsNewFolderDialogOpen(false)}
          onCreateFolder={handleCreateFolder}
        />
      </Sidebar>
    );
  }

  // Fallback: render static layout from templateData database files
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{title}</SidebarGroupLabel>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarGroupAction>
                <Plus className="h-4 w-4" />
              </SidebarGroupAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onSync && (
                <>
                  <DropdownMenuItem onClick={onSync}>
                    <RotateCw className="h-4 w-4 mr-2 text-blue-500" />
                    Sync Files from Sandbox
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleAddRootFile}>
                <FilePlus className="h-4 w-4 mr-2" />
                New File
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleAddRootFolder}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SidebarGroupContent>
            <SidebarMenu>
              {isRootFolder ? (
                (data as TemplateFolder).items.map((child, index) => (
                  <TemplateNode
                    key={index}
                    item={child}
                    onFileSelect={onFileSelect}
                    selectedFile={selectedFile}
                    level={0}
                    path=""
                    onAddFile={onAddFile}
                    onAddFolder={onAddFolder}
                    onDeleteFile={onDeleteFile}
                    onDeleteFolder={onDeleteFolder}
                    onRenameFile={onRenameFile}
                    onRenameFolder={onRenameFolder}
                  />
                ))
              ) : (
                <TemplateNode
                  item={data}
                  onFileSelect={onFileSelect}
                  selectedFile={selectedFile}
                  level={0}
                  path=""
                  onAddFile={onAddFile}
                  onAddFolder={onAddFolder}
                  onDeleteFile={onDeleteFile}
                  onDeleteFolder={onDeleteFolder}
                  onRenameFile={onRenameFile}
                  onRenameFolder={onRenameFolder}
                />
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />

      <NewFileDialog
        isOpen={isNewFileDialogOpen}
        onClose={() => setIsNewFileDialogOpen(false)}
        onCreateFile={handleCreateFile}
      />

      <NewFolderDialog
        isOpen={isNewFolderDialogOpen}
        onClose={() => setIsNewFolderDialogOpen(false)}
        onCreateFolder={handleCreateFolder}
      />
    </Sidebar>
  );
}

interface SandboxFolderNodeProps {
  name: string;
  path: string;
  instance: any;
  level: number;
  onFileSelect?: (file: TemplateFile) => void;
  selectedFile?: TemplateFile;
  onAddFile?: (file: TemplateFile, parentPath: string) => void;
  onAddFolder?: (folder: TemplateFolder, parentPath: string) => void;
  onDeleteFile?: (file: TemplateFile, parentPath: string) => void;
  onDeleteFolder?: (folder: TemplateFolder, parentPath: string) => void;
  onRenameFile?: (file: TemplateFile, newFilename: string, newExtension: string, parentPath: string) => void;
  onRenameFolder?: (folder: TemplateFolder, newFolderName: string, parentPath: string) => void;
  onSync?: () => void;
  isRoot?: boolean;
}

function SandboxFolderNode({
  name,
  path,
  instance,
  level,
  onFileSelect,
  selectedFile,
  onAddFile,
  onAddFolder,
  onDeleteFile,
  onDeleteFolder,
  onRenameFile,
  onRenameFolder,
  onSync,
  isRoot = false,
}: SandboxFolderNodeProps) {
  const [isOpen, setIsOpen] = React.useState(isRoot || (level < 1 && name !== "node_modules"));
  const [children, setChildren] = React.useState<Array<{ name: string; isDirectory: boolean }>>([]);
  const [loading, setLoading] = React.useState(false);
  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = React.useState(false);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = React.useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const fetchChildren = React.useCallback(async () => {
    if (!instance) return;
    setLoading(true);
    try {
      const entries = await instance.fs.readdir(path, { withFileTypes: true });
      const sorted = entries
        .map((e: any) => ({ name: e.name, isDirectory: e.isDirectory() }))
        .sort((a: any, b: any) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
      setChildren(sorted);
    } catch (err) {
      console.error("Error reading directory:", path, err);
    } finally {
      setLoading(false);
    }
  }, [instance, path]);

  React.useEffect(() => {
    if (isOpen) {
      fetchChildren();
    }
  }, [isOpen, fetchChildren]);

  const refresh = fetchChildren;

  const handleCreateFile = async (filename: string, extension: string) => {
    const fileExt = extension.trim();
    const newFile: TemplateFile = {
      filename,
      fileExtension: fileExt,
      content: "",
    };
    if (onAddFile) {
      await onAddFile(newFile, path);
    } else {
      const targetPath = path ? `${path}/${filename}${fileExt ? `.${fileExt}` : ""}` : `${filename}${fileExt ? `.${fileExt}` : ""}`;
      await instance.fs.writeFile(targetPath, "");
    }
    refresh();
    setIsNewFileDialogOpen(false);
  };

  const handleCreateFolder = async (folderName: string) => {
    const newFolder: TemplateFolder = {
      folderName,
      items: [],
    };
    if (onAddFolder) {
      await onAddFolder(newFolder, path);
    } else {
      const targetPath = path ? `${path}/${folderName}` : folderName;
      await instance.fs.mkdir(targetPath, { recursive: true });
    }
    refresh();
    setIsNewFolderDialogOpen(false);
  };

  const handleDeleteSubmit = async () => {
    if (onDeleteFolder) {
      const mockFolder: TemplateFolder = { folderName: name, items: [] };
      const parentPath = path.substring(0, path.lastIndexOf("/"));
      await onDeleteFolder(mockFolder, parentPath);
    } else {
      await instance.fs.rm(path, { recursive: true });
    }
    setIsDeleteDialogOpen(false);
  };

  const handleRenameSubmit = async (newName: string) => {
    if (onRenameFolder) {
      const mockFolder: TemplateFolder = { folderName: name, items: [] };
      const parentPath = path.substring(0, path.lastIndexOf("/"));
      await onRenameFolder(mockFolder, newName, parentPath);
    } else {
      const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      const renameScript = `
        const fs = require('fs');
        fs.renameSync('${path}', '${newPath}');
      `;
      await instance.fs.writeFile("rename-helper.js", renameScript);
      const renameProc = await instance.spawn("node", ["rename-helper.js"]);
      await renameProc.exit;
      await instance.fs.rm("rename-helper.js");
    }
    setIsRenameDialogOpen(false);
  };

  if (isRoot) {
    return (
      <>
        {children.map((child) => {
          const childPath = path ? `${path}/${child.name}` : child.name;
          return child.isDirectory ? (
            <SandboxFolderNode
              key={child.name}
              name={child.name}
              path={childPath}
              instance={instance}
              level={level + 1}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              onAddFile={onAddFile}
              onAddFolder={onAddFolder}
              onDeleteFile={onDeleteFile}
              onDeleteFolder={onDeleteFolder}
              onRenameFile={onRenameFile}
              onRenameFolder={onRenameFolder}
              onSync={onSync}
            />
          ) : (
            <SandboxFileNode
              key={child.name}
              name={child.name}
              path={childPath}
              instance={instance}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              onDeleteFile={onDeleteFile}
              onRenameFile={onRenameFile}
              refreshParent={refresh}
            />
          );
        })}
      </>
    );
  }

  const isNodeModules = name === "node_modules";
  const folderColor = isNodeModules ? "text-emerald-500" : "text-amber-500 dark:text-amber-400";

  return (
    <SidebarMenuItem>
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="group/collapsible [&[data-state=open]>div>button>svg:first-child]:rotate-90"
      >
        <div className="flex items-center group">
          <CollapsibleTrigger asChild>
            <SidebarMenuButton className="flex-1">
              <ChevronRight className="transition-transform" />
              {isOpen ? (
                <FolderOpen className={`h-4 w-4 mr-2 shrink-0 ${folderColor}`} />
              ) : (
                <FolderClosed className={`h-4 w-4 mr-2 shrink-0 ${folderColor}`} />
              )}
              <span>{name}</span>
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsNewFileDialogOpen(true)}>
                <FilePlus className="h-4 w-4 mr-2" />
                New File
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsNewFolderDialogOpen(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </DropdownMenuItem>
              {!isNodeModules && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsRenameDialogOpen(true)}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CollapsibleContent>
          <SidebarMenuSub>
            {loading && <div className="text-xs text-muted-foreground p-2">Loading...</div>}
            {children.map((child) => {
              const childPath = `${path}/${child.name}`;
              return child.isDirectory ? (
                <SandboxFolderNode
                  key={child.name}
                  name={child.name}
                  path={childPath}
                  instance={instance}
                  level={level + 1}
                  onFileSelect={onFileSelect}
                  selectedFile={selectedFile}
                  onAddFile={onAddFile}
                  onAddFolder={onAddFolder}
                  onDeleteFile={onDeleteFile}
                  onDeleteFolder={onDeleteFolder}
                  onRenameFile={onRenameFile}
                  onRenameFolder={onRenameFolder}
                  onSync={onSync}
                />
              ) : (
                <SandboxFileNode
                  key={child.name}
                  name={child.name}
                  path={childPath}
                  instance={instance}
                  onFileSelect={onFileSelect}
                  selectedFile={selectedFile}
                  onDeleteFile={onDeleteFile}
                  onRenameFile={onRenameFile}
                  refreshParent={refresh}
                />
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>

      <NewFileDialog
        isOpen={isNewFileDialogOpen}
        onClose={() => setIsNewFileDialogOpen(false)}
        onCreateFile={handleCreateFile}
      />

      <NewFolderDialog
        isOpen={isNewFolderDialogOpen}
        onClose={() => setIsNewFolderDialogOpen(false)}
        onCreateFolder={handleCreateFolder}
      />

      <RenameFolderDialog
        isOpen={isRenameDialogOpen}
        onClose={() => setIsRenameDialogOpen(false)}
        onRename={handleRenameSubmit}
        currentFolderName={name}
      />

      <DeleteDialog
        isOpen={isDeleteDialogOpen}
        setIsOpen={setIsDeleteDialogOpen}
        onConfirm={handleDeleteSubmit}
        title="Delete Folder"
        description={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
        itemName={name}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </SidebarMenuItem>
  );
}

interface SandboxFileNodeProps {
  name: string;
  path: string;
  instance: any;
  onFileSelect?: (file: TemplateFile) => void;
  selectedFile?: TemplateFile;
  onDeleteFile?: (file: TemplateFile, parentPath: string) => void;
  onRenameFile?: (file: TemplateFile, newFilename: string, newExtension: string, parentPath: string) => void;
  refreshParent: () => void;
}

function SandboxFileNode({
  name,
  path,
  instance,
  onFileSelect,
  selectedFile,
  onDeleteFile,
  onRenameFile,
  refreshParent,
}: SandboxFileNodeProps) {
  const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const fileExt = name.split('.').pop() || '';
  const fileNameOnly = name.substring(0, name.lastIndexOf('.')) || name;

  const fileObject: TemplateFile = {
    filename: fileNameOnly,
    fileExtension: fileExt,
    content: "",
    id: path,
  };

  const isSelected = selectedFile && 
    (selectedFile.id === path || 
     (selectedFile.filename === fileNameOnly && selectedFile.fileExtension === fileExt));

  const handleDeleteSubmit = async () => {
    if (onDeleteFile) {
      const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
      await onDeleteFile(fileObject, parentPath);
    } else {
      await instance.fs.rm(path);
    }
    refreshParent();
    setIsDeleteDialogOpen(false);
  };

  const handleRenameSubmit = async (newFilename: string, newExtension: string) => {
    if (onRenameFile) {
      const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
      await onRenameFile(fileObject, newFilename, newExtension, parentPath);
    } else {
      const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
      const newExtSuffix = newExtension ? `.${newExtension}` : "";
      const newPath = parentPath ? `${parentPath}/${newFilename}${newExtSuffix}` : `${newFilename}${newExtSuffix}`;
      
      const renameScript = `
        const fs = require('fs');
        fs.renameSync('${path}', '${newPath}');
      `;
      await instance.fs.writeFile("rename-helper.js", renameScript);
      const renameProc = await instance.spawn("node", ["rename-helper.js"]);
      await renameProc.exit;
      await instance.fs.rm("rename-helper.js");
    }
    refreshParent();
    setIsRenameDialogOpen(false);
  };

  return (
    <SidebarMenuItem>
      <div className="flex items-center group">
        <SidebarMenuButton
          isActive={isSelected}
          onClick={() => onFileSelect?.(fileObject)}
          className="flex-1"
        >
          {getFileIcon(name)}
          <span>{name}</span>
        </SidebarMenuButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsRenameDialogOpen(true)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RenameFileDialog
        isOpen={isRenameDialogOpen}
        onClose={() => setIsRenameDialogOpen(false)}
        onRename={handleRenameSubmit}
        currentFilename={fileNameOnly}
        currentExtension={fileExt}
      />

      <DeleteDialog
        isOpen={isDeleteDialogOpen}
        setIsOpen={setIsDeleteDialogOpen}
        onConfirm={handleDeleteSubmit}
        title="Delete File"
        description={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
        itemName={name}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </SidebarMenuItem>
  );
}

// FALLBACK Node for static database template content (before instance is loaded)
interface TemplateNodeProps {
  item: TemplateItem;
  onFileSelect?: (file: TemplateFile) => void;
  selectedFile?: TemplateFile;
  level: number;
  path?: string;
  onAddFile?: (file: TemplateFile, parentPath: string) => void;
  onAddFolder?: (folder: TemplateFolder, parentPath: string) => void;
  onDeleteFile?: (file: TemplateFile, parentPath: string) => void;
  onDeleteFolder?: (folder: TemplateFolder, parentPath: string) => void;
  onRenameFile?: (
    file: TemplateFile,
    newFilename: string,
    newExtension: string,
    parentPath: string
  ) => void;
  onRenameFolder?: (
    folder: TemplateFolder,
    newFolderName: string,
    parentPath: string
  ) => void;
}

function TemplateNode({
  item,
  onFileSelect,
  selectedFile,
  level,
  path = "",
  onAddFile,
  onAddFolder,
  onDeleteFile,
  onDeleteFolder,
  onRenameFile,
  onRenameFolder,
}: TemplateNodeProps) {
  const isValidItem = item && typeof item === "object";
  const isFolder = isValidItem && "folderName" in item;
  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = React.useState(false);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] =
    React.useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(level < 2);

  if (!isValidItem) return null;

  if (!isFolder) {
    const file = item as TemplateFile;
    const fileName = `${file.filename}.${file.fileExtension}`;

    const isSelected =
      selectedFile &&
      selectedFile.filename === file.filename &&
      selectedFile.fileExtension === file.fileExtension;

    const handleRename = () => {
      setIsRenameDialogOpen(true);
    };

    const handleDelete = () => {
      setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
      onDeleteFile?.(file, path);
      setIsDeleteDialogOpen(false);
    };

    const handleRenameSubmit = (newFilename: string, newExtension: string) => {
      onRenameFile?.(file, newFilename, newExtension, path);
      setIsRenameDialogOpen(false);
    };

    return (
      <SidebarMenuItem>
        <div className="flex items-center group">
          <SidebarMenuButton
            isActive={isSelected}
            onClick={() => onFileSelect?.(file)}
            className="flex-1"
          >
            {getFileIcon(fileName)}
            <span>{fileName}</span>
          </SidebarMenuButton>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRename}>
                <Edit3 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <RenameFileDialog
          isOpen={isRenameDialogOpen}
          onClose={() => setIsRenameDialogOpen(false)}
          onRename={handleRenameSubmit}
          currentFilename={file.filename}
          currentExtension={file.fileExtension}
        />

        <DeleteDialog
          isOpen={isDeleteDialogOpen}
          setIsOpen={setIsDeleteDialogOpen}
          onConfirm={confirmDelete}
          title="Delete File"
          description={`Are you sure you want to delete "${fileName}"? This action cannot be undone.`}
          itemName={fileName}
          confirmLabel="Delete"
          cancelLabel="Cancel"
        />
      </SidebarMenuItem>
    );
  } else {
    const folder = item as TemplateFolder;
    const folderName = folder.folderName;
    const currentPath = path ? `${path}/${folderName}` : folderName;

    const handleAddFile = () => {
      setIsNewFileDialogOpen(true);
    };

    const handleAddFolder = () => {
      setIsNewFolderDialogOpen(true);
    };

    const handleRename = () => {
      setIsRenameDialogOpen(true);
    };

    const handleDelete = () => {
      setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
      onDeleteFolder?.(folder, path);
      setIsDeleteDialogOpen(false);
    };

    const handleCreateFile = (filename: string, extension: string) => {
      if (onAddFile) {
        const newFile: TemplateFile = {
          filename,
          fileExtension: extension,
          content: "",
        };
        onAddFile(newFile, currentPath);
      }
      setIsNewFileDialogOpen(false);
    };

    const handleCreateFolder = (folderName: string) => {
      if (onAddFolder) {
        const newFolder: TemplateFolder = {
          folderName,
          items: [],
        };
        onAddFolder(newFolder, currentPath);
      }
      setIsNewFolderDialogOpen(false);
    };

    const handleRenameSubmit = (newFolderName: string) => {
      onRenameFolder?.(folder, newFolderName, path);
      setIsRenameDialogOpen(false);
    };

    return (
      <SidebarMenuItem>
        <Collapsible
          open={isOpen}
          onOpenChange={setIsOpen}
          className="group/collapsible [&[data-state=open]>div>button>svg:first-child]:rotate-90"
        >
          <div className="flex items-center group">
            <CollapsibleTrigger asChild>
              <SidebarMenuButton className="flex-1">
                <ChevronRight className="transition-transform" />
                {isOpen ? (
                  <FolderOpen className="h-4 w-4 mr-2 shrink-0 text-amber-500 dark:text-amber-400" />
                ) : (
                  <FolderClosed className="h-4 w-4 mr-2 shrink-0 text-amber-500 dark:text-amber-400" />
                )}
                <span>{folderName}</span>
              </SidebarMenuButton>
            </CollapsibleTrigger>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleAddFile}>
                  <FilePlus className="h-4 w-4 mr-2" />
                  New File
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddFolder}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleRename}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <CollapsibleContent>
            <SidebarMenuSub>
              {folder.items.map((childItem, index) => (
                <TemplateNode
                  key={index}
                  item={childItem}
                  onFileSelect={onFileSelect}
                  selectedFile={selectedFile}
                  level={level + 1}
                  path={currentPath}
                  onAddFile={onAddFile}
                  onAddFolder={onAddFolder}
                  onDeleteFile={onDeleteFile}
                  onDeleteFolder={onDeleteFolder}
                  onRenameFile={onRenameFile}
                  onRenameFolder={onRenameFolder}
                />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>

        <NewFileDialog
          isOpen={isNewFileDialogOpen}
          onClose={() => setIsNewFileDialogOpen(false)}
          onCreateFile={handleCreateFile}
        />

        <NewFolderDialog
          isOpen={isNewFolderDialogOpen}
          onClose={() => setIsNewFolderDialogOpen(false)}
          onCreateFolder={handleCreateFolder}
        />

        <RenameFolderDialog
          isOpen={isRenameDialogOpen}
          onClose={() => setIsRenameDialogOpen(false)}
          onRename={handleRenameSubmit}
          currentFolderName={folderName}
        />

        <DeleteDialog
          isOpen={isDeleteDialogOpen}
          setIsOpen={setIsDeleteDialogOpen}
          onConfirm={confirmDelete}
          title="Delete Folder"
          description={`Are you sure you want to delete "${folderName}" and all its contents? This action cannot be undone.`}
          itemName={folderName}
          confirmLabel="Delete"
          cancelLabel="Cancel"
        />
      </SidebarMenuItem>
    );
  }
}
