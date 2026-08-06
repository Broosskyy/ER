# Architecture — Import Channel Isolation

Shared: unified_import_result_contract, identity_matching, merge_engine, canonical_writers, review_infrastructure

Isolated per channel: raw job identity, scheduling, retry policy, channel provenance.

Policies:
- **manual_admin_import:** pause-affected=false, overwrite-manual=false
- **automatic_source_import:** pause-affected=true, overwrite-manual=false
- **ai_assisted_import:** pause-affected=false, overwrite-manual=false
