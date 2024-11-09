import type { Process } from "./types.ts";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "dotenv";
config();

// delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// promptFill
const promptFill = (sentence: string, VARIABLES: any) => {
  return sentence.replace(/{(\w+)}/g, (match, key) => {
    return VARIABLES[key] || match;
  });
};

// getLLMResponse
const getLLMResponse = async (
  prompt: string,
  model_name: string,
  genAI: any
) => {
  const model = genAI.getGenerativeModel({ model: model_name });
  const result = await model.generateContent(prompt);
  return result.response.text();
};

// Define types for our log entries
type LogEntry = {
    node_index: number;
    node_type: string;
    status: "SUCCESS" | "ERROR";
    output?: string;
    error?: string;
    timestamp: string;
    execution_time_ms: number; // New field for node execution time
};

type FlowLog = {
    logs: LogEntry[];
    total_execution_time_ms: number;
};

// run flow
const genAI = new GoogleGenerativeAI(process.env.GEMINI_APIKEY!);
const FLASH_MODEL = "gemini-1.5-flash";
const PRO_MODEL = "gemini-pro";
const VARIABLES = {};
const LOG: LogEntry[] = [];

export const runFlow = async (VARIABLES: any, PROCESS: Process): Promise<FlowLog> => {
  const flowStartTime = Date.now();

  for (let index = 0; index < PROCESS.length; index++) {
    const nodeStartTime = Date.now();
    const node = PROCESS[index];
    const logEntry: LogEntry = {
      node_index: index,
      node_type: node.type,
      status: "SUCCESS",
      timestamp: new Date().toISOString(),
      execution_time_ms: 0
    };

    try {
      if (node.type == "llm") {
        try {
          const nodeResponse = await getLLMResponse(
            promptFill(node.prompt, VARIABLES),
            node.model,
            genAI
          );
          PROCESS[index].status = "SUCCESS";
          PROCESS[index].output = nodeResponse || "no process";
          VARIABLES.PREV_OUTPUT = nodeResponse;
          logEntry.output = nodeResponse;
        } catch (err) {
          PROCESS[index].status = "ERROR";
          logEntry.status = "ERROR";
          logEntry.error = err instanceof Error ? err.message : String(err);
          throw err;
        }
      }

      if (node.type == "mapper") {
        try {
          const exec = JSON.parse(JSON.stringify(node.exec));
          const func = new Function("return " + exec)();
          const result = func(VARIABLES.PREV_OUTPUT);
          PROCESS[index].output = result;
          VARIABLES[node.key] = result;
          VARIABLES.PREV_OUTPUT = result;
          logEntry.output = JSON.stringify(result);
        } catch (err) {
          logEntry.status = "ERROR";
          logEntry.error = err instanceof Error ? err.message : String(err);
          throw err;
        }
      }

      if (node.type == "switch") {
        try {
          const exec = JSON.parse(JSON.stringify(node.switch));
          const func = new Function("return " + exec)();
          const SUBPROCESS = func(node.parameter);
          if (SUBPROCESS) {
            const subProcessResult = await runFlow(VARIABLES, SUBPROCESS);
            logEntry.output = JSON.stringify(subProcessResult);
          }
        } catch (err) {
          logEntry.status = "ERROR";
          logEntry.error = err instanceof Error ? err.message : String(err);
          throw err;
        }
      }
    } catch (err) {
      logEntry.status = "ERROR";
      logEntry.error = err instanceof Error ? err.message : String(err);
    } finally {
      logEntry.execution_time_ms = Date.now() - nodeStartTime;
      LOG.push(logEntry);
    }

    await delay(1000);
  }

  return {
    logs: LOG,
    total_execution_time_ms: Date.now() - flowStartTime
  };
};