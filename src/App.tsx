/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useRef, useState, Suspense } from "react";
import "./App.scss";
import { LiveAPIProvider } from "./contexts/LiveAPIContext";
import cn from "classnames";

// Lazy loaded components
const SidePanel = React.lazy(() => import("./components/side-panel/SidePanel"));
const ControlTray = React.lazy(() => import("./components/control-tray/ControlTray"));

// Import GenList directly since it's not a default export
const GenListComponent = React.lazy(() => 
  import("./components/genlist/GenList").then(module => ({
    default: module.GenList
  }))
);

// Loading component
const LoadingSpinner = () => (
  <div className="loading-spinner">
    <div className="spinner"></div>
    <style>{`
      .loading-spinner {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100px;
      }
      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--gray-600);
        border-radius: 50%;
        border-top-color: var(--accent-blue);
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `}</style>
  </div>
);

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY as string;
if (typeof API_KEY !== "string") {
  throw new Error("set REACT_APP_GEMINI_API_KEY in .env");
}

const host = "generativelanguage.googleapis.com";
const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

function App() {
  // this video reference is used for displaying the active stream, whether that is the webcam or screen capture
  // feel free to style as you see fit
  const videoRef = useRef<HTMLVideoElement>(null);
  // either the screen capture, the video or null, if null we hide it
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  return (
    <div className="App">
      <LiveAPIProvider url={uri} apiKey={API_KEY}>
        <div className="streaming-console">
          <Suspense fallback={<LoadingSpinner />}>
            <SidePanel />
          </Suspense>
          <main>
            <div className="main-app-area">
              <Suspense fallback={<LoadingSpinner />}>
                <GenListComponent />
              </Suspense>
              <video
                className={cn("stream", {
                  hidden: !videoRef.current || !videoStream,
                })}
                ref={videoRef}
                autoPlay
                playsInline
              />
            </div>

            <Suspense fallback={<LoadingSpinner />}>
              <ControlTray
                videoRef={videoRef}
                supportsVideo={true}
                onVideoStreamChange={setVideoStream}
              >
                {/* put your own buttons here */}
              </ControlTray>
            </Suspense>
          </main>
        </div>
      </LiveAPIProvider>
    </div>
  );
}

export default App;
