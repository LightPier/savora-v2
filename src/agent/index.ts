import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { addClient, addClientToolDef } from "../tools/add-client.js";
import { getClient, getClientToolDef } from "../tools/get-client.js";
import { updateClient, updateClientToolDef } from "../tools/update-client.js";
import { logMeal, logMealToolDef } from "../tools/log-meal.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1024;

// ─── Types ──────────────────────────────────────────────────────────

type Message = Anthropic.MessageParam;
type ContentBlock = Anthropic.ContentBlock;

export interface Agent {
  chefId: string;
  systemPrompt: string;
  tools: Anthropic.Tool[];
  client: Anthropic;
}

export interface TurnResult {
  response: string;
  messages: Message[];
}

// ─── Tool dispatch ──────────────────────────────────────────────────

type ToolHandler = (input: any) => Promise<any>;

function createToolHandlers(chefId: string): Record<string, ToolHandler> {
  return {
    add_client: (input) => addClient({ ...input, chef_id: chefId }),
    get_client: (input) => getClient({ ...input, chef_id: chefId }),
    update_client: (input) => updateClient({ ...input, chef_id: chefId }),
    log_meal: (input) => logMeal({ ...input, chef_id: chefId }),
  };
}

// ─── Agent creation ─────────────────────────────────────────────────

export function createAgent(chefId: string): Agent {
  const promptPath = path.resolve(__dirname, "../../prompts/system.md");
  const systemPrompt = fs.readFileSync(promptPath, "utf-8");

  return {
    chefId,
    systemPrompt,
    tools: [addClientToolDef, getClientToolDef, updateClientToolDef, logMealToolDef],
    client: new Anthropic(),
  };
}

// ─── Turn execution (tool-call loop) ────────────────────────────────

export async function runTurn(
  agent: Agent,
  messages: Message[]
): Promise<TurnResult> {
  const handlers = createToolHandlers(agent.chefId);
  const updatedMessages = [...messages];

  // Loop until the model produces a final text response
  while (true) {
    const response = await agent.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: agent.systemPrompt,
      tools: agent.tools,
      messages: updatedMessages,
    });

    // Append the assistant's response to the conversation
    updatedMessages.push({ role: "assistant", content: response.content });

    // If the model is done (no tool calls), extract the text and return
    if (response.stop_reason === "end_turn" || response.stop_reason === "max_tokens") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      return { response: text, messages: updatedMessages };
    }

    // Handle tool calls
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        const handler = handlers[block.name];
        if (!handler) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Unknown tool: ${block.name}`,
            is_error: true,
          });
          continue;
        }

        try {
          const result = await handler(block.input);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (err: any) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${err.message}`,
            is_error: true,
          });
        }
      }

      // Append tool results as a user message and loop
      updatedMessages.push({ role: "user", content: toolResults });
    }
  }
}
