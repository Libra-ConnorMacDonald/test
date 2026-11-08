# Post-Task — Update Docs and Commit

> **How to use this prompt**
> Paste it into the agent session once a task's implementation is reported complete. It runs the
> close-out checklist in `docs/general_docs/CLOSE_OUT.md`. If the task ran through the
> `task-dispatcher` skill, its close-out has already run: check what it wrote rather than redo it.

---

Task implementation is reported complete. Before I consider it done, run the close-out checklist in
`docs/general_docs/CLOSE_OUT.md`, "After every task", in full. Do not write new feature code.

Then report back as its last step describes, and propose the merge-back sequence from
`docs/general_docs/COLLABORATION.md` without running it.

Do not start the next task: wait for the next prompt.

## Rules

- `AGENTS.md` changes follow "Changing AGENTS.md" in `CLOSE_OUT.md`: propose them and wait for my approval.
- Do not invent rules or mandates that aren't already in the reference docs. If something should become a rule, flag it for me.
- If anything is unclear, ask rather than guess.
