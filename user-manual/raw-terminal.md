# The raw terminal

The **Raw terminal** tab (in the _Advanced_ group) is the power-user escape
hatch: the unfiltered line stream from the node, and a box to type raw cluster
commands.

You should rarely need it — every cluster feature has a GUI equivalent — but it
is useful for:

- seeing exactly what a node sent (debugging a parser edge case),
- running an obscure command the Tools panel doesn't list,
- watching the login handshake.

## Behaviour

- **Auto-follow** — new output scrolls into view **only while you are at the
  bottom**. Scroll up to read and it pauses; a **"↓ N"** pill resumes.
- Outgoing lines you type are echoed with an `>` marker; node lines and errors
  are shown as received.
- The command box sends to the currently selected
  [send-target](settings.md) node.

## A word of caution

Raw commands bypass the app's safety nets (the non-ASCII mail warning, the
`/EX` padding in the mail composer, dialect-correct filter syntax). If you push
a node-side filter by hand, the Filters panel won't know about it.
