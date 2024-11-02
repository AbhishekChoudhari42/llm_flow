type ProcessStep = 
    | LlmStep
    | MapperStep
    | SwitchStep;

interface LlmStep {
    type: "llm";
    model: string;
    prompt: string;
    status: string | null;
    output: string | null;
}

interface MapperStep {
    type: "mapper";
    exec: (input: any) => any;
    status: string;
    output: string | null;
    key: string;
}

interface SwitchStep {
    type: "switch";
    parameter: string;
    switch: (Direction: string) => LlmStep[] | null;
    status:string
    output:any
}

export type Process = ProcessStep[];