"use client";

import { ExternalLink, Info, Network, Shield, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export function PortMappingExplainer() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="p-1 hover:bg-muted rounded-md transition-colors inline-flex items-center gap-1 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span className="text-xs">What is this?</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-96" collisionPadding={16} avoidCollisions={true}>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Network className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Port Mapping Explained</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Port mapping allows services running inside your container to be accessed from
              outside. Without it, your apps would be completely isolated.
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <h5 className="text-sm font-medium">How it works:</h5>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-primary font-mono text-xs mt-0.5">1.</span>
                <p className="text-muted-foreground">
                  You start a web server on port <code className="bg-muted px-1 rounded">3000</code>{" "}
                  inside your container
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-mono text-xs mt-0.5">2.</span>
                <p className="text-muted-foreground">
                  You create a port mapping for port <code className="bg-muted px-1 rounded">3000</code>
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-mono text-xs mt-0.5">3.</span>
                <p className="text-muted-foreground">
                  The sandbox provides a unique URL to access your service
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ExternalLink className="h-4 w-4" />
              <span className="font-medium">Example Access URL:</span>
            </div>
            <code className="text-xs text-primary">
              https://sandbox.example.com/service/abc123/3000/
            </code>
          </div>

          <Separator />

          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Security Warning:</strong> Exposed ports are accessible to anyone with the
              URL. Only expose ports for services you intend to share. Never expose sensitive
              services or APIs without proper authentication.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h5 className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              Best Practices
            </h5>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Only expose ports when needed</li>
              <li>Use authentication for sensitive APIs</li>
              <li>Remove unused port mappings</li>
              <li>Be cautious with database ports</li>
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Inline tooltip version for compact spaces
export function PortMappingTooltip() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="p-0.5 hover:bg-muted rounded transition-colors">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72" collisionPadding={16} avoidCollisions={true}>
        <div className="space-y-2">
          <p className="text-sm font-medium">What is port mapping?</p>
          <p className="text-xs text-muted-foreground">
            Port mapping lets you access web servers, APIs, and other services running inside
            your container from your browser.
          </p>
          <Alert variant="destructive" className="py-1.5">
            <AlertTriangle className="h-3 w-3" />
            <AlertDescription className="text-[10px]">
              Exposed ports are publicly accessible. Only expose what you need.
            </AlertDescription>
          </Alert>
        </div>
      </PopoverContent>
    </Popover>
  );
}
