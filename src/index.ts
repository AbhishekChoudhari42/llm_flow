import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { runFlow } from "./helper.js";
import { supabase } from "./client.js";
import * as fs from "fs";
const app = new Hono();
const port = 3000;

//hardcoded UserID and FlowID
const user_id = 'fb7ff3a3-e087-4310-a29b-3f33b928813a'
const flow_id = 'df7d82dd-5cdb-4768-9b4c-18e856d94a71'

//Get flows by userID
app.get('/flow/:user_id', async (c) => {
  try {
    const userId = c.req.param('user_id');
    
    const { data: flows, error } = await supabase
      .from('flows')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ 
        success: false, 
        error: 'Failed to fetch flows' 
      }, 500);
    }

    return c.json({
      success: true,
      data: flows || []
    });

  } catch (error) {
    console.error('Error in flow retrieval:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

//Runs the flow 
app.post("/flow/run", async (c) => {
  try {
    const { PROCESS, VARIABLES } = await c.req.json();
    console.log({ PROCESS, VARIABLES });
    
    // Execute the flow and get detailed logs with execution time
    const { logs, total_execution_time_ms } = await runFlow(VARIABLES, PROCESS);
    
    // Insert logs into Supabase
    const { error } = await supabase
      .from('logs')
      .insert({
        user_id,
        flow_id,
        log_data: logs,
        created_at: new Date().toISOString(),
        status: logs.some(log => log.status === "ERROR") ? "ERROR" : "SUCCESS",
        total_execution_time_ms // New field for total execution time
      });

    if (error) {
      console.error("Error inserting logs:", error);
      return c.json({ 
        success: false, 
        error: "Failed to save logs" 
      }, 500);
    }

    // Write logs to file (optional)
    fs.writeFile("./example.txt", JSON.stringify({ logs, total_execution_time_ms }, null, 2), (err) => {
      if (err) {
        console.error("Error writing to the file:", err);
      } else {
        console.log("File written successfully");
      }
    });

    return c.json({ 
      success: true, 
      logs,
      total_execution_time_ms,
      status: logs.some(log => log.status === "ERROR") ? "ERROR" : "SUCCESS"
    });

  } catch (error) {
    console.error("Error in flow execution:", error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

serve({
  fetch: app.fetch,
  port,
});