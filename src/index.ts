import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import {runFlow} from './helper.js'
import * as fs from 'fs' 
const app = new Hono()
const port = 3000

app.post('/', async (c) => {
  const {PROCESS,VARIABLES} = await c.req.json()
  console.log({PROCESS,VARIABLES})
  const result = await runFlow(VARIABLES,PROCESS)
  console.log(result)
  fs.writeFile('./example.txt', JSON.stringify(result), (err) => {
    if (err) {
        console.error('Error writing to the file:', err);
        return;
    }
    console.log('File written successfully');
});
  return c.text('Hello Hono!')
})

serve({
  fetch: app.fetch,
  port
})
