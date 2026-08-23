


/*** IMPORT ------------------------------------------- ***/

import { green, magenta, underline } from "@std/fmt/colors";
import { join } from "@std/path";

import dedent from "@netopwibby/dedent";

/*** UTILITY ------------------------------------------ ***/

import getBinaryContents from "helper/get-binary-contents.ts";
import getDocuments from "helper/get-documents.ts";
import renderMarkdown from "helper/render-markdown.ts";

const BASE_DIRECTORY = await Deno.realPath(".");
const ENVIRONMENT = Deno.args.includes("development") ? "development" : "production";
const DOCUMENTS_DIRECTORY = join(BASE_DIRECTORY, "documents");
const PORT = Number(Deno.env.has("PORT") ? Deno.env.get("PORT") : 29655);
const VERSION = await getVersion();

/*** PROGRAM ------------------------------------------ ***/

const server = Deno.serve({
  handler: async(req) => {
    const { pathname } = new URL(req.url);

    if (pathname === "/") {
      const data = String(await renderMarkdown(join(DOCUMENTS_DIRECTORY, "index.md")));
      return new Response(data, { headers: { "content-type": "text/html; charset=utf-8" }});
    }

    if (pathname === "/static/base.css") {
      const FILE_PATH = join("static", "base.css");

      return new Response(
        await getBinaryContents(FILE_PATH), {
          headers: {
            "cache-control": "public, max-age=31536000, immutable",
            "content-type": "text/css"
          }
        }
      );
    }

    if (pathname === "/static/disc.svg") {
      const FILE_PATH = join("static", "disc.svg");

      return new Response(
        await getBinaryContents(FILE_PATH), {
          headers: {
            "cache-control": "public, max-age=31536000, immutable",
            "content-type": "image/svg+xml"
          }
        }
      );
    }

    if (pathname === "/static/jetbrains-medium.woff2") {
      const filePath = join("static", "jetbrains-medium.woff2");

      return new Response(
        await getBinaryContents(filePath), {
          headers: {
            "cache-control": "public, max-age=31536000, immutable",
            "content-type": "font/woff2"
          }
        }
      );
    }

    if (pathname === "/static/highlight.min.js") {
      const filePath = join("static", "highlight.min.js");

      return new Response(
        await getBinaryContents(filePath), {
          headers: {
            "cache-control": "public, max-age=31536000, immutable",
            "content-type": "text/javascript"
          }
        }
      );
    }

    if (pathname === "/static/open-graph-logo.png") {
      const FILE_PATH = join("static", "open-graph-logo.png");

      return new Response(
        await getBinaryContents(FILE_PATH), {
          headers: {
            "cache-control": "public, max-age=31536000, immutable",
            "content-type": "image/png"
          }
        }
      );
    }

    if (pathname === "/static/style.css") {
      const FILE_PATH = join("static", "style.css");

      return new Response(
        await getBinaryContents(FILE_PATH), {
          headers: {
            // "cache-control": "public, max-age=31536000, immutable",
            "content-type": "text/css"
          }
        }
      );
    }

    if (/d*.md$/.test(pathname)) {
      const SLUG = pathname.slice(1);
      const DOCUMENTS = await getDocuments(DOCUMENTS_DIRECTORY);

      if (DOCUMENTS && DOCUMENTS.indexOf(SLUG) < 0) {
        return new Response(
          "womp", {
            headers: {
              "content-type": "text/plain; charset=utf-8"
            }
          }
        );
      }

      const data = String(await renderMarkdown(join(DOCUMENTS_DIRECTORY, SLUG)));
      return new Response(data, { headers: { "content-type": "text/html; charset=utf-8" }});
    }

    return new Response(
      "womp", {
        headers: {
          "content-type": "text/plain; charset=utf-8"
        }
      }
    ); /*** 404 by default ***/
  },
  hostname: "0.0.0.0",
  onListen() {
    console.log(
      dedent`\n
     ┌${repeatCharacter("─", 32)}┐
     │ ${fit("DISC.MD")} │
     │ ${fit(`→ ${ENVIRONMENT}`)} │
     │ ${green(fit(VERSION))} │
     └${repeatCharacter("─", 32)}┘
      LOCAL ${magenta(`${underline(`${this.hostname}:${PORT}`)}`)}
      \n`
    );
  },
  port: PORT
}) as Deno.HttpServer;

Deno.addSignalListener("SIGINT", gracefulShutdown);
Deno.addSignalListener("SIGTERM", gracefulShutdown);

/*** HELPER ------------------------------------------- ***/

function fit(input: string) {
  const remainingSpace = 30 - input.length; /*** 34 - 4 (border + one space each side) ***/
  return input + " ".repeat(remainingSpace);
}

export async function getVersion() {
  let version = "";

  try {
    version = await Deno.readTextFile("./version.txt");
  } catch {
    /*** ignore ***/
  }

  return version.trim();
}

async function gracefulShutdown() {
  await server.shutdown();
}

function repeatCharacter(input: string, repeatAmount: number): string {
  if (!repeatAmount || repeatAmount <= 0)
    return input;

  return input.repeat(repeatAmount);
}
