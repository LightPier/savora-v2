import readline from "node:readline";
import { supabase } from "../db/client.js";
import { createAgent, runTurn, type Agent, type TurnResult } from "../agent/index.js";
import type Anthropic from "@anthropic-ai/sdk";

const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

async function loadChef(): Promise<string> {
  const { data: chef, error } = await supabase
    .from("chefs")
    .select("id, name")
    .eq("name", "Georgie")
    .single();

  if (error || !chef) {
    console.error("Could not load chef. Run `npm run seed` first.");
    process.exit(1);
  }

  return chef.id;
}

async function main() {
  const chefId = await loadChef();
  const agent = createAgent(chefId);

  let messages: Anthropic.MessageParam[] = [];

  console.log(`${DIM}Savora CLI — type as Georgie. Ctrl+C to exit.${RESET}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${BOLD}chef> ${RESET}`,
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    messages.push({ role: "user", content: input });

    try {
      const result: TurnResult = await runTurn(agent, messages);
      messages = result.messages;
      console.log(`\n${CYAN}savora>${RESET} ${result.response}\n`);
    } catch (err: any) {
      console.error(`\n${DIM}Error: ${err.message}${RESET}\n`);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log(`\n${DIM}Bye!${RESET}`);
    process.exit(0);
  });
}

main();
