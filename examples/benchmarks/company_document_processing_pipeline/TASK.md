# Benchmark: regulated document processing pipeline (frozen wording)

Design a **batch document intake** path for **compliance**: objects land in **source** storage, pass through **transform** (OCR / redaction profile id), **route** by partition key (jurisdiction or sensitivity), and land in an **evidence sink** with **retention class** and optional **legal hold**. Each batch needs **audit trail** and **correlation** ids for replay.

Use TORQA’s **data pipeline** posture: rich `requires` and stage **comments**; **empty `flow:`** unless the operator UI explicitly wraps login (this benchmark stays pipeline-first).

_Version: P128 benchmark seed — keep this file stable for token comparisons._
