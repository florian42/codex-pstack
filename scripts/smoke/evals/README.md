# Optional eval suite

Cases for `claude plugin eval`, which is early access and may be gated. The
behavior smoke harness runs this suite with `--eval`: it copies the cases into a
scratch copy of the generated plugin, checks enablement, and skips with a
notice when the command reports early access. Each case mirrors a harness case
so the two layers grade the same behavior.
