


/*** IMPORT ------------------------------------------- ***/

import { read, type Compatible } from "to-vfile";
import rehypeDocument from "rehype-document";
import rehypeFormat from "rehype-format";
import rehypeMeta from "rehype-meta";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

/*** EXPORT ------------------------------------------- ***/

export default async(FILE_PATH: Compatible) => {
  return await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .use(rehypeDocument, {
      css: "https://uchu.style/uchu.css",
      js: [
        "/static/highlight.min.js"
      ],
      language: "en",
      link: [
        { href: "https://rsms.me/", rel: "preconnect" },
        { href: "https://rsms.me/inter/inter.css", rel: "stylesheet" },
        { href: "/static/base.css", rel: "stylesheet" },
        { href: "/static/disc.svg", rel: "icon", type: "image/svg+xml" },
        { href: "/static/style.css", rel: "stylesheet" }
      ]
    })
    .use(rehypeMeta, {
      description: "Disc is a schema-first, TypeScript-native database built on Deno; with this documentation site, you can learn how to use it.",
      image: {
        alt: "pixelated CD positioned between letters spelling 'disc'",
        height: "630",
        url: "/static/open-graph-logo.png",
        width: "1200"
      },
      og: true,
      title: "Disc • documentation for the database for users"
    })
    .use(rehypeFormat)
    .process(await read(FILE_PATH))
}
