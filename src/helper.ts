import type { Process } from "./types.ts"; 
import { GoogleGenerativeAI } from '@google/generative-ai';
// delay
const delay = (ms:number) => new Promise((resolve) => setTimeout(resolve, ms));

// promptFill
const promptFill = (sentence:string, VARIABLES:any) => {
    return sentence.replace(/{(\w+)}/g, (match, key) => {
        return VARIABLES[key] || match; 
    });
};
// getLLMResponse
const getLLMResponse = async (prompt:string, model_name:string , genAI:any) => {
    const model = genAI.getGenerativeModel({ model: model_name });
    const result = await model.generateContent(prompt);
    return result.response.text();
}
// run flow
const genAI = new GoogleGenerativeAI(process.env.GEMINI_APIKEY!);
const FLASH_MODEL = "gemini-1.5-flash";
const PRO_MODEL = "gemini-pro";
const VARIABLES = {}
const LOG :any[] = []
export const runFlow = async (VARIABLES:any, PROCESS:Process) => {
    let output = null;
    for (let index = 0; index < PROCESS.length; index++) {
        const node = PROCESS[index];
        if (node.type == "llm") {
            try {
                const nodeResponse = await getLLMResponse(
                    promptFill(node.prompt,VARIABLES),
                    node.model,genAI
                );
                PROCESS[index].status = "SUCCESS";
                PROCESS[index].output = nodeResponse || "no process";
                VARIABLES.PREV_OUTPUT = nodeResponse;
                LOG.push(nodeResponse);
            } catch (err) {
                PROCESS[index].status = "ERROR";
            }
        }
        if (node.type == "mapper") {
            const exec = JSON.parse(JSON.stringify(node.exec))
            const func = new Function('return ' + exec)();
            const result = func(VARIABLES.PREV_OUTPUT);
            PROCESS[index].output = result;
            VARIABLES[node.key] = result
            VARIABLES.PREV_OUTPUT = result;
            
            
        }
        if (node.type == "switch") {

            const exec = JSON.parse(JSON.stringify(node.switch))
            const func = new Function('return ' + exec)();
            const SUBPROCESS = func(node.parameter)
            if (SUBPROCESS) {
                await runFlow(VARIABLES, SUBPROCESS);
            }
        }
        await delay(1000);
    }
    return LOG
};