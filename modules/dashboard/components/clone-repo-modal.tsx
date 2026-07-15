import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Github, Loader2, GitFork, Search, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

interface CloneRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloneRepoModal = ({ isOpen, onClose }: CloneRepoModalProps) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingConn, setCheckingConn] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [repos, setRepos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [loadingStep, setLoadingStep] = useState("");

  // Fetch GitHub Connection Status & Repos
  useEffect(() => {
    if (isOpen) {
      checkGithubConnection();
    }
  }, [isOpen]);

  const checkGithubConnection = async () => {
    try {
      setCheckingConn(true);
      const res = await fetch("/api/github/repos");
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setGithubConnected(true);
          setRepos(data.repos || []);
        } else {
          setGithubConnected(false);
        }
      }
    } catch (e) {
      setGithubConnected(false);
    } finally {
      setCheckingConn(false);
    }
  };

  const handleConnectGithub = () => {
    signIn("github");
  };

  const triggerClone = async (url: string, title?: string) => {
    try {
      setLoading(true);
      setLoadingStep("Connecting to repository...");
      
      const steps = [
        "Running git clone...",
        "Downloading repository files...",
        "Scanning project layout...",
        "Detecting project template...",
        "Constructing playground sandbox...",
        "Redirecting to IDE..."
      ];
      
      let stepIndex = 0;
      const interval = setInterval(() => {
        if (stepIndex < steps.length) {
          setLoadingStep(steps[stepIndex]);
          stepIndex++;
        }
      }, 1500);

      const res = await fetch("/api/workspace/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: url, customizeTitle: title }),
      });

      clearInterval(interval);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to clone repository.");
      }

      const data = await res.json();
      toast.success("Repository cloned successfully!");
      router.push(`/playground/${data.playgroundId}`);
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to clone repository.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const handleCloneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) {
      toast.error("Please enter a repository URL.");
      return;
    }
    triggerClone(repoUrl, customTitle);
  };

  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-zinc-950 border border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-rose-500">
            <GitFork className="h-5 w-5" />
            <span>Clone Repository</span>
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Import projects directly from GitHub to run and edit them in your browser.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
            <div className="text-center">
              <p className="font-semibold text-zinc-200">Cloning in progress</p>
              <p className="text-xs text-rose-400/80 animate-pulse mt-1">{loadingStep}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 py-2">
            {/* GitHub Connection Block */}
            {checkingConn ? (
              <div className="flex items-center justify-center py-4 text-xs text-zinc-500 gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking GitHub connection...</span>
              </div>
            ) : githubConnected ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-emerald-400 border border-emerald-950/40 bg-emerald-950/10 px-3 py-2 rounded-md">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Connected to GitHub
                  </span>
                  <Button variant="link" onClick={handleConnectGithub} className="h-auto p-0 text-xs text-emerald-400 underline">
                    Switch Account
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-zinc-400">Select one of your repositories:</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input
                      placeholder="Search repositories..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 text-xs bg-zinc-900 border-zinc-800 focus-visible:ring-rose-500"
                    />
                  </div>

                  <div className="border border-zinc-800 rounded-md bg-zinc-900/40 max-h-40 overflow-y-auto divide-y divide-zinc-800">
                    {filteredRepos.length > 0 ? (
                      filteredRepos.map((repo) => (
                        <div
                          key={repo.fullName}
                          onClick={() => triggerClone(repo.htmlUrl, repo.name)}
                          className="flex items-center justify-between p-2.5 hover:bg-zinc-900 cursor-pointer text-xs transition-colors"
                        >
                          <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                            <Github className="h-3.5 w-3.5 text-zinc-400" />
                            {repo.name}
                          </span>
                          {repo.private ? (
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">Private</span>
                          ) : (
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">Public</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center p-6 text-zinc-500 text-xs">No repositories found.</div>
                    )}
                  </div>
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-zinc-800"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-zinc-600 uppercase font-bold tracking-wider">or clone by URL</span>
                  <div className="flex-grow border-t border-zinc-800"></div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 border border-zinc-800 bg-zinc-900/20 p-4 rounded-lg items-center text-center">
                <Github className="h-8 w-8 text-zinc-400" />
                <div>
                  <h4 className="text-sm font-semibold text-zinc-200">Connect to GitHub</h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    Connect your account to easily view and import your personal repositories with one click.
                  </p>
                </div>
                <Button onClick={handleConnectGithub} className="bg-zinc-100 text-zinc-950 hover:bg-zinc-200 text-xs w-full py-1.5 flex items-center justify-center gap-2">
                  <Github className="h-4 w-4" />
                  <span>Sign in with GitHub</span>
                </Button>
              </div>
            )}

            {/* Manual URL Form */}
            {(!githubConnected || repos.length === 0) && (
              <form onSubmit={handleCloneSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="repoUrl" className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Paste Repository GitHub URL:</span>
                  </Label>
                  <Input
                    id="repoUrl"
                    placeholder="https://github.com/username/repository"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="text-xs bg-zinc-900 border-zinc-800 focus-visible:ring-rose-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="customTitle" className="text-xs text-zinc-400">
                    Custom Project Name (Optional):
                  </Label>
                  <Input
                    id="customTitle"
                    placeholder="My Cloned App"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="text-xs bg-zinc-900 border-zinc-800 focus-visible:ring-rose-500"
                  />
                </div>

                <Button type="submit" className="bg-rose-600 hover:bg-rose-700 text-zinc-100 text-xs w-full py-2">
                  Clone Repository
                </Button>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
