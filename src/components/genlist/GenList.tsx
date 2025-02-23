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
import "./GenList.scss";
import { type Tool, SchemaType } from "@google/generative-ai";
import { useEffect, useState, useCallback, memo, useRef } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import {
  ToolCall,
  ToolResponse,
  LiveFunctionResponse,
} from "../../multimodal-live-types";
import { List, ListProps } from "./List";
import { Chips } from "./Chips";

// Types
interface CreateListArgs {
  id: string;
  heading: string;
  list_array: string[];
}
interface EditListArgs extends CreateListArgs {}
interface RemoveListArgs {
  id: string;
}
interface ResponseObject extends LiveFunctionResponse {
  name: string;
  response: { result: object };
}

// Tools
const toolObject: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "start_camera",
        description: "Requests camera access and initiates video feed",
      },
      {
        name: "analyze_visual",
        description: "Analyzes current camera feed for issues",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            focus_area: {
              type: SchemaType.STRING,
              description: "Area to analyze: 'display', 'connection', 'drum', 'filter', etc.",
            },
          },
          required: ["focus_area"],
        },
      },
      {
        name: "create_checklist",
        description: "Creates diagnostic checklist based on visual analysis",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            issue_type: {
              type: SchemaType.STRING,
            },
            steps: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.STRING,
              },
            },
          },
          required: ["issue_type", "steps"],
        },
      },
      {
        name: "update_checklist",
        description: "Updates checklist based on completed steps",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            issue_type: {
              type: SchemaType.STRING,
            },
            completed_steps: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.STRING,
              },
            },
          },
          required: ["issue_type", "completed_steps"],
        },
      },
    ],
  },
];

const systemInstructionObject = {
  parts: [
    {
      text: `You are Telek's Washing Machine Assistant, specialized in providing real-time visual guidance through live camera feed.

Initial Interaction:
1. Always start by requesting the user to turn on their camera
2. Guide user to properly position the camera for optimal viewing
3. Provide real-time feedback on camera positioning

Key Capabilities:
1. Live Visual Analysis:
   - Real-time machine part identification
   - Live error code reading
   - Active leak detection
   - Dynamic movement analysis
   - Guide users to adjust camera angles as needed

2. Audio Analysis:
   - Real-time sound assessment
   - Beep pattern interpretation

3. Interactive Troubleshooting:
   - Live step-by-step guidance based on visual feed
   - Real-time feedback on user actions
   - Dynamic adjustment of instructions based on what's visible
   - Immediate safety warnings when risky actions detected

# Troubleshooting Guidelines:
- Create diagnostic checklists with emojis (e.g. "🔍 Initial Assessment")
- Use descriptive IDs for tracking issues (e.g. "water-leak-front")
- Format steps using checkboxes: "- [ ] Step to complete" or "- [x] Completed step"
- Organize with clear headings (e.g. "## Safety Checks")
- Add detailed explanations for technical terms
- Always verify step completion through visual confirmation

Safety First:
- Always begin with power/water safety checks
- Provide clear warnings about electrical hazards
- Guide users to unplug machine when necessary
- Recommend professional help for complex issues

Response Style:
- Clear, concise instructions
- Patient, step-by-step guidance
- Regular confirmation of user understanding
- Immediate acknowledgment of visible actions`,
    },
  ],
};

// Chips
const INITIAL_SCREEN_CHIPS = [
  { label: "📸 Start Diagnosis", message: "Please help me diagnose my washing machine issue" },
  { label: "🔊 Sound Check", message: "My washing machine is making unusual sounds" },
  { label: "💧 Water Leak", message: "I see water leaking from my machine" },
  { label: "⚠️ Error Help", message: "I need help with an error code" }
];

const LIST_SCREEN_CHIPS = [
  {
    label: "📷 Adjust Camera",
    message: "Help me position the camera better",
  },
  {
    label: "✅ Mark Complete",
    message: "I've completed this step",
  },
  {
    label: "❓ Need Help",
    message: "I need more detailed instructions",
  },
  { label: "🔄 Start Over", message: "Let's start the diagnosis again" },
];

function GenListComponent() {
  const { client, setConfig, connect, connected } = useLiveAPIContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Camera handling functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, // Prefer back camera
        audio: true 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraStream(stream);
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      // Create an error list to show to the user
      const errorList = {
        id: "camera-error",
        heading: "⚠️ Camera Access Required",
        list_array: [
          "- [ ] Please enable camera access to continue",
          "- [ ] Make sure no other app is using the camera",
          "- [ ] Try refreshing the page if issues persist"
        ]
      };
      setListsState([errorList as ListProps]);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraActive(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: "audio", // Using audio mode which includes both audio and text response
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
        },
      },
      systemInstruction: systemInstructionObject,
      tools: toolObject,
    });
  }, [setConfig]);

  const [isAwaitingFirstResponse, setIsAwaitingFirstResponse] = useState(false);
  const [initialMessage, setInitialMessage] = useState("");
  const [listsState, setListsState] = useState<ListProps[]>([]);
  const [toolResponse, setToolResponse] = useState<ToolResponse | null>(null);

  // Update existing list
  const updateList = useCallback((listId: string, updatedList: string[]) => {
    setListsState((prevLists) =>
      prevLists.map((list) => {
        if (list.id === listId) {
          return { ...list, list_array: updatedList };
        } else {
          return list;
        }
      })
    );
  }, []);

  // Scroll to new list after timeout
  const scrollToList = (id: string) => {
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 100);
  };

  // Handle checkbox change from List component
  const handleCheckboxChange = useCallback((listId: string, index: number) => {
    setListsState((prevLists) =>
      prevLists.map((list) => {
        if (list.id === listId) {
          const updatedList = [...list.list_array];
          const item = updatedList[index];
          if (item.startsWith("- [ ] ")) {
            updatedList[index] = item.replace("- [ ] ", "- [x] ");
          } else if (item.startsWith("- [x] ")) {
            updatedList[index] = item.replace("- [x] ", "- [ ] ");
          }
          return { ...list, list_array: updatedList };
        }
        return list;
      })
    );
  }, []);

  useEffect(() => {
    const onToolCall = (toolCall: ToolCall) => {
      const fCalls = toolCall.functionCalls;
      const functionResponses: ResponseObject[] = [];

      if (fCalls.length > 0) {
        fCalls.forEach((fCall) => {
          let functionResponse = {
            id: fCall.id,
            name: fCall.name,
            response: {
              result: { string_value: `${fCall.name} OK.` },
            },
          };

          switch (fCall.name) {
            case "start_camera": {
              startCamera();
              break;
            }
            case "analyze_visual": {
              const args = fCall.args as { focus_area: string };
              functionResponse.response.result = { 
                string_value: `Analyzing ${args.focus_area}...`
              };
              break;
            }
            case "create_checklist": {
              const args = fCall.args as { issue_type: string; steps: string[] };
              const newList: ListProps = {
                id: args.issue_type,
                heading: `🔍 ${args.issue_type}`,
                list_array: args.steps,
                onListUpdate: updateList,
                onCheckboxChange: handleCheckboxChange,
              };
              setListsState(prevLists => [...prevLists, newList]);
              break;
            }
            case "update_checklist": {
              const args = fCall.args as { issue_type: string; completed_steps: string[] };
              updateList(args.issue_type, args.completed_steps);
              break;
            }
            case "edit_list": {
              const args = fCall.args as EditListArgs;
              updateList(args.id, args.list_array);
              break;
            }
            case "remove_list": {
              const args = fCall.args as RemoveListArgs;
              setListsState((prevLists) =>
                prevLists.filter((list) => list.id !== args.id)
              );
              break;
            }
            case "create_list": {
              const args = fCall.args as EditListArgs;
              const newList: ListProps = {
                id: args.id,
                heading: args.heading,
                list_array: args.list_array,
                onListUpdate: updateList,
                onCheckboxChange: handleCheckboxChange,
              };
              setListsState((prevLists) => {
                const updatedLists = [...prevLists, newList];
                return updatedLists;
              });
              scrollToList(newList.id);
              break;
            }
          }
          if (functionResponse) {
            functionResponses.push(functionResponse);
          }
        });

        const toolResponse: ToolResponse = {
          functionResponses: functionResponses,
        };
        setToolResponse(toolResponse);
      }
    };
    setIsAwaitingFirstResponse(false);
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client, handleCheckboxChange, updateList]);

  useEffect(() => {
    if (toolResponse) {
      const updatedToolResponse: ToolResponse = {
        ...toolResponse,
        functionResponses: toolResponse.functionResponses.map(
          (functionResponse) => {
            const responseObject = functionResponse as ResponseObject;
            if (responseObject.name === "look_at_lists") {
              return {
                ...functionResponse,
                response: {
                  result: {
                    object_value: listsState,
                  },
                },
              };
            } else {
              return functionResponse;
            }
          }
        ),
      };
      client.sendToolResponse(updatedToolResponse);
      setToolResponse(null);
    }
  }, [toolResponse, listsState, client, setToolResponse]);

  const connectAndSend = async (message: string) => {
    setIsAwaitingFirstResponse(true);
    if (!connected) {
      try {
        await connect();
      } catch (error) {
        throw new Error("Could not connect to Websocket");
      }
    }
    client.send({
      text: `${message}`,
    });
  };

  //   Rendered if list length === 0
  const renderInitialScreen = () => {
    return (
      <>
        {/* Hide while connecting to API */}
        {!isAwaitingFirstResponse && (
          <div className="initial-screen">
            <div className="spacer"></div>
            <h1>📝 Start a list about:</h1>
            <input
              type="text"
              value={initialMessage}
              className="initialMessageInput"
              placeholder="type or say something..."
              onChange={(e) => setInitialMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  connectAndSend(`Start a list about: ${initialMessage}`);
                }
              }}
            />
            <div className="spacer"></div>
            <Chips
              title={"How about:"}
              chips={INITIAL_SCREEN_CHIPS}
              onChipClick={(message) => {
                connectAndSend(`Start a list about: ${message}`);
              }}
            />
            <div className="spacer"></div>
          </div>
        )}
      </>
    );
  };

  //   Rendered if list length > 0
  const renderListScreen = () => {
    return (
      <>
        <div className="list-screen">
          {listsState.map((listData) => (
            <List
              key={listData.id}
              id={listData.id}
              heading={listData.heading}
              list_array={listData.list_array}
              onListUpdate={updateList}
              onCheckboxChange={handleCheckboxChange}
            />
          ))}
          <Chips
            title={"Try saying:"}
            chips={LIST_SCREEN_CHIPS}
            onChipClick={(message) => {
              client.send({ text: message });
            }}
          />
        </div>
      </>
    );
  };

  return (
    <div className="app">
      <div className="camera-section">
        {isCameraActive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ 
              width: '100%',
              maxHeight: '40vh',
              objectFit: 'contain'
            }}
          />
        )}
      </div>
      <div className="content-section">
        {listsState.length === 0 ? renderInitialScreen() : renderListScreen()}
      </div>
    </div>
  );
}

export const GenList = memo(GenListComponent);
