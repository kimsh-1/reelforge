| ID | 기능명 | 설명(1-2줄) | 근거(파일:라인) | 채택제안 | 검증방법 |
|---|---|---|---|---|---|
| ARC-001 | 严格场景契约 | 所有剧本模型禁止额外字段，能把 LLM 幻觉字段在落盘前挡住。 | `lib/script_models.py:16-24` | P0(PoC필수) 계약핵심 | `pytest tests/test_scene_manifest_contract.py` |
| ARC-002 | 运行时字段对 LLM 隐藏 | `generated_assets`、模式字段等只由编排层注入，不让模型推断或污染合同。 | `lib/script_models.py:171-179`, `lib/script_models.py:770-797` | P0(PoC필수) 오염차단 | `pytest tests/test_llm_schema_visibility.py` |
| ARC-003 | 标准生成资产槽 | 分镜、尾帧、视频、缩略图、旁白、状态统一进入 `generated_assets`，适合部分重渲染索引。 | `lib/script_models.py:118-131`, `lib/project_manager.py:870-891` | P0(PoC필수) 부분렌더기반 | `pytest tests/test_generated_assets_contract.py` |
| ARC-004 | 内容模式与生成模式解耦 | `content_mode` 决定剧本结构，`generation_mode` 决定生成路径，避免一个字段承担两种语义。 | `lib/script_skeleton.py:65-83` | P0(PoC필수) 모드분리 | `pytest tests/test_script_kind_resolution.py` |
| ARC-005 | 数据形状优先识别脚本 | 读取时按 `segments/scenes/shots/video_units` 识别骨架，兼容迁移和脏元数据。 | `lib/script_skeleton.py:86-125` | P1(코어) 마이그레이션 | `pytest tests/test_script_skeleton.py` |
| ARC-006 | 供应商时长枚举合同 | 根据模型能力动态生成 Pydantic 枚举，让 LLM 输出阶段就受合法时长约束。 | `lib/script_models.py:802-858` | P0(PoC필수) 품질게이트 | `pytest tests/test_duration_schema.py` |
| ARC-007 | 参考视频单元时长一致性 | 多 shot 单元要求总时长等于各 shot 之和，并落在供应商支持档位内。 | `lib/script_models.py:716-767`, `lib/script_models.py:907-925` | P0(PoC필수) 타이밍핵심 | `pytest tests/test_reference_unit_duration.py` |
| ARC-008 | 参考图顺序即索引 | `references` 顺序决定后端提示里的 `[图N]`，让资产引用可复现。 | `lib/script_models.py:743-748`, `lib/reference_video/shot_parser.py:136-151` | P1(코어) 참조결정성 | `pytest tests/test_reference_indexing.py` |
| ARC-009 | 台词与画外音分型 | `dialogue` 必须有 speaker，`voiceover` 必须无 speaker，便于字幕、TTS、口型分流。 | `lib/script_models.py:296-331` | P0(PoC필수) 자막기반 | `pytest tests/test_utterance_contract.py` |
| ARC-010 | 旧对白结构读时迁移 | 老的 `dialogue/voiceover` 会迁移成有序 `utterances`，减少合同升级成本。 | `lib/script_models.py:334-425` | P2(확장) 이식보조 | `pytest tests/test_utterance_migration.py` |
| ARC-011 | 两阶段说书生成 | 第一步锁定原文和资产引用，第二步只补视觉字段，避免视觉重写正文。 | `lib/script_models.py:223-287`, `lib/prompt_builders_script.py:238-327` | P0(PoC필수) 원문보존 | `pytest tests/test_narration_two_step.py` |
| ARC-012 | 两阶段剧集生成 | 第一步确定场景、台词和 source text，第二步按 ID 补视觉提示词。 | `lib/script_models.py:448-487`, `lib/prompt_builders_script.py:385-457` | P0(PoC필수) 내용고정 | `pytest tests/test_drama_two_step.py` |
| ARC-013 | 视觉合并 fail-loud | step2 视觉结果按 ID 合并，重复、缺失、悬空、缺视觉字段全部失败。 | `lib/script_models.py:530-583` | P0(PoC필수) 품질게이트 | `pytest tests/test_visual_merge_fail_loud.py` |
| ARC-014 | 广告 shot 平铺合同 | 广告用平铺 shots，包含 section、口播、产品引用和画面提示，方便短视频节奏控制。 | `lib/script_models.py:589-618` | P2(확장) 광고확장 | `pytest tests/test_ad_shot_contract.py` |
| ARC-015 | 广告参考视频轻量索引 | `reference_units` 由 shots 派生，不替代 shots 真相源，适合分组生成视频。 | `lib/script_models.py:621-649`, `lib/reference_video/ad_units.py:1-8` | P2(확장) 분组생성 | `pytest tests/test_ad_reference_units.py` |
| ARC-016 | 编辑补丁保护资产字段 | 脚本编辑禁止直接 patch `id` 和 `generated_assets`，防止 UI 改坏运行时状态。 | `lib/script_editor.py:77-108` | P0(PoC필수) 상태보호 | `pytest tests/test_script_editor_patch.py` |
| ARC-017 | 拆分镜头稳定 ID | 拆分时首段保留原 ID 和资产，其余派生新 ID 并清空资产，适合局部重渲染。 | `lib/script_editor.py:59-74`, `lib/script_editor.py:144-194` | P1(코어) 부분재렌더 | `pytest tests/test_split_segment_assets.py` |
| ARC-018 | 保存时不更坏校验 | 写脚本前验证结构，改后非法且改前合法则拒绝，保护人工编辑。 | `lib/project_manager.py:535-641`, `lib/project_manager.py:737-754` | P0(PoC필수) 하드게이트 | `pytest tests/test_no_worse_save.py` |
| ARC-019 | episode 文件一致性守卫 | 剧本内 episode 与文件名不一致时拒绝保存，防错写分集。 | `lib/project_manager.py:711-728` | P1(코어) 데이터보호 | `pytest tests/test_episode_file_guard.py` |
| ARC-020 | 脚本锁和项目锁顺序 | 统一脚本锁到项目锁顺序，并复核 episode 与 script_file 绑定，防 TOCTOU。 | `lib/project_manager.py:668-709`, `lib/project_manager.py:1379-1413` | P1(코어) 동시성보호 | `pytest tests/test_script_locking.py` |
| ARC-021 | 统计字段读时计算 | 场景数、状态、进度不落盘，避免生成过程中的冗余状态漂移。 | `lib/project_manager.py:1644-1667` | P1(코어) 상태일관성 | `pytest tests/test_status_read_model.py` |
| ARC-022 | 资产类型统一 spec | character、scene、prop、product 用同一 spec 驱动字段、路由和 agent 可编辑权限。 | `lib/asset_types.py:16-91` | P1(코어) 자산확장성 | `pytest tests/test_asset_specs.py` |
| ARC-023 | 跨平台资产命名守卫 | 禁止路径分隔符、控制字符、Windows 保留名和 `..`，适合本地渲染缓存。 | `lib/asset_types.py:110-137` | P0(PoC필수) 파일안전 | `pytest tests/test_asset_name_validation.py` |
| ARC-024 | 资产 upsert 白名单诊断 | Agent 批量写资产时只接受白名单字段，并返回 added、merged、dropped 诊断。 | `lib/project_manager.py:1738-1870` | P1(코어) 에이전트안전 | `pytest tests/test_asset_upsert_whitelist.py` |
| ARC-025 | 产品原图追加式引用 | 产品参考图只增不重复，保留原始图作为后续视频保真锚点。 | `lib/project_manager.py:2044-2062` | P2(확장) 상품보존 | `pytest tests/test_product_reference_images.py` |
| ARC-026 | 媒体版本时间机 | 每次生成复制成版本记录，支持当前版本追踪、恢复、URL 查询。 | `lib/version_manager.py:125-187`, `lib/version_manager.py:215-303` | P0(PoC필수) 회귀가능 | `pytest tests/test_version_manager.py` |
| ARC-027 | 当前文件自动补登记 | 发现已有当前文件但缺版本记录时自动补齐，降低历史项目迁移风险。 | `lib/version_manager.py:215-250` | P1(코어) 마이그레이션 | `pytest tests/test_ensure_current_tracked.py` |
| ARC-028 | 资产指纹 cache-bust | 扫描媒体文件 mtime_ns，前端可按资源粒度刷新预览而非整页刷新。 | `lib/asset_fingerprints.py:5-50` | P0(PoC필수) 부분刷新 | `pytest tests/test_asset_fingerprints.py` |
| ARC-029 | 成功事件携带受影响指纹 | 生成完成后发布项目变更和受影响文件指纹，驱动局部 UI 更新。 | `server/services/generation_tasks.py:602-769` | P0(PoC필수) 대시보드핵심 | `pytest tests/test_generation_events.py` |
| ARC-030 | 后端按任务懒初始化 | 只初始化任务需要的 image、video、audio 后端，减少启动和测试成本。 | `server/services/generation_tasks.py:198-267` | P1(코어) 운영효율 | `pytest tests/test_backend_lazy_init.py` |
| ARC-031 | provider/model 分层解析 | 后端选择按 payload、project、global 逐层解析，既支持全局默认也支持单任务覆盖。 | `lib/config/resolver.py:229-273`, `lib/config/resolver.py:470-531` | P1(코어) 설정핵심 | `pytest tests/test_backend_resolution.py` |
| ARC-032 | T2I 与 I2I 能力门控 | 分镜有参考图时要求 I2I 能力，无参考图时走 T2I，避免运行时才失败。 | `server/services/generation_tasks.py:73-90`, `lib/config/resolver.py:229-242` | P1(코어) 능력검증 | `pytest tests/test_image_capability_gate.py` |
| ARC-033 | 视频是否自动生音频旋钮 | `video_generate_audio` 支持项目覆盖、全局配置和默认值。 | `lib/config/resolver.py:207-213` | P2(확장) 공급자옵션 | `pytest tests/test_video_generate_audio_config.py` |
| ARC-034 | TTS 声音和语速层级配置 | 旁白 voice、speed 支持项目覆盖和全局默认，非法 speed 宽容回退。 | `lib/config/resolver.py:275-305` | P1(코어) TTS핵심 | `pytest tests/test_audio_voice_speed.py` |
| ARC-035 | 分辨率按模型解析 | 优先项目 model_settings，再查自定义模型默认分辨率，否则让供应商默认处理。 | `server/services/resolution_resolver.py:27-69` | P1(코어) 렌더일관성 | `pytest tests/test_resolution_resolver.py` |
| ARC-036 | 供应商能力注册表 | 模型记录能力、支持时长、分辨率、最大参考图、定价和隐藏状态。 | `lib/config/registry.py:24-42` | P1(코어) 공급자계약 | `pytest tests/test_provider_registry.py` |
| ARC-037 | 参考图压缩阶梯 | 上传副本按总量和单图预算压缩，遇 413 继续降档，保护生成任务成功率。 | `lib/reference_compression.py:1-12`, `lib/media_generator.py:166-210` | P1(코어) 안정성 | `pytest tests/test_reference_compression.py` |
| ARC-038 | FRAME 与 ARRAY 压缩分工 | 首尾帧不缩尺寸，只在超预算时重编码；普通参考图可缩尺寸。 | `lib/reference_compression.py:56-61`, `lib/reference_compression.py:121-155` | P1(코어) 품질보존 | `pytest tests/test_reference_roles.py` |
| ARC-039 | 生成调用计费闭环 | 图片、视频、TTS 都 start_call、finish_call、add_version，便于成本审计。 | `lib/media_generator.py:249-395`, `lib/media_generator.py:397-486`, `lib/media_generator.py:534-742` | P1(코어) 비용추적 | `pytest tests/test_usage_tracking.py` |
| ARC-040 | provider_job_id 立即持久化 | 提交后立刻写 job_id，失败 fail-fast，避免重启后无法 resume。 | `lib/video_backends/base.py:49-90` | P0(PoC필수) 재개핵심 | `pytest tests/test_provider_job_persistence.py` |
| ARC-041 | api_call_id 持久化账目 | 生成前挂起的 api_call_id 写回 task payload，resume 成功后精准结账。 | `lib/video_backends/base.py:104-126`, `lib/media_generator.py:744-872` | P1(코어) 비용정확성 | `pytest tests/test_api_call_resume_accounting.py` |
| ARC-042 | 歧义提交不重试 | 请求可能已送达时抛 AmbiguousSubmitError，不盲目重试，避免双扣费。 | `lib/video_backends/base.py:188-220`, `lib/video_backends/base.py:256-286` | P0(PoC필수) 비용보호 | `pytest tests/test_ambiguous_submit.py` |
| ARC-043 | submit、poll、download 重试分层 | 提交只重试确定未送达，轮询可重试传输和 404，下载 URL 404 不重试。 | `lib/video_backends/base.py:151-165`, `lib/video_backends/base.py:223-253` | P1(코어) 장애복원 | `pytest tests/test_video_retry_policy.py` |
| ARC-044 | provider×media 并发槽 | worker 按供应商和媒体类型限流，避免单供应商被 image/video 混合任务打满。 | `lib/generation_worker.py:89-155`, `lib/generation_worker.py:221-315` | P1(코어) 운영안정 | `pytest tests/test_worker_capacity.py` |
| ARC-045 | lease-based worker 归属 | worker 获取、续租、释放 lease，支持单 active worker 和启动时 orphan 扫描。 | `lib/db/repositories/task_repo.py:960-1032`, `lib/generation_worker.py:433-482` | P1(코어) 작업일관성 | `pytest tests/test_worker_lease.py` |
| ARC-046 | 任务依赖和去重 | 队列支持活跃任务去重，依赖任务成功后才可领取。 | `lib/db/repositories/task_repo.py:100-267` | P0(PoC필수) 부분렌더큐 | `pytest tests/test_task_dedup_dependencies.py` |
| ARC-047 | 取消状态机级联 | queued 直接 cancelled，running 进入 cancelling，并级联取消下游依赖。 | `lib/db/repositories/task_repo.py:441-454`, `lib/db/repositories/task_repo.py:529-652` | P1(코어) 사용자제어 | `pytest tests/test_task_cancel_cascade.py` |
| ARC-048 | orphan 恢复不重复扣费 | 启动时 image/audio 不重跑，video 只在可 resume 时接续，不主动重复消费。 | `lib/generation_worker.py:800-899` | P0(PoC필수) 비용보호 | `pytest tests/test_orphan_recovery.py` |
| ARC-049 | resume 路径锁定原 provider | resume 只用持久化 provider，不走常规能力重判和新流水线。 | `lib/generation_worker.py:696-779` | P0(PoC필수) 재개정확성 | `pytest tests/test_resume_provider_lock.py` |
| ARC-050 | 结构化 prompt YAML | 图片和视频 prompt 转成固定顺序 YAML，减少提示词字段漂移。 | `lib/prompt_utils.py:49-108`, `server/services/generation_tasks.py:287-356` | P0(PoC필수) 프롬프트계약 | `pytest tests/test_prompt_yaml.py` |
| ARC-051 | 可观察动作提示词规则 | 视频 action、camera、ambiance_audio 要求物理可见或场内声音，禁止 BGM 幻觉。 | `lib/script_models.py:91-93`, `lib/prompt_builders_script.py:108-129` | P0(PoC필수) 영상품질 | `pytest tests/test_prompt_rules.py` |
| ARC-052 | 产品保真尾词 | 只有实际注入产品参考图时追加产品保真要求，且幂等追加。 | `lib/prompt_builders.py:124-148`, `server/services/generation_tasks.py:772-860` | P2(확장) 상품영상 | `pytest tests/test_product_fidelity_tail.py` |
| ARC-053 | 统一视频反向尾词 | 视频生成统一追加反向提示，集中管理崩坏规避词。 | `lib/prompt_builders.py:151-161` | P1(코어) 품질기본 | `pytest tests/test_video_negative_tail.py` |
| ARC-054 | drama 台词只进 dialogue | 只有 dialogue-kind utterance 进入视频 prompt，voiceover 保留给字幕和 TTS。 | `lib/prompt_utils.py:111-145`, `server/services/generation_tasks.py:943-1073` | P0(PoC필수) 자막분리 | `pytest tests/test_dialogue_projection.py` |
| ARC-055 | TTS 单镜头生成 | 旁白优先用 payload 文本，否则用 segment 原文；空文本直接失败。 | `server/services/generation_tasks.py:863-940` | P0(PoC필수) 오디오핵심 | `pytest tests/test_tts_task.py` |
| ARC-056 | 视频时长执行期守卫 | duration 解析为整数，并校验是否在供应商 supported_durations 内。 | `server/services/generation_tasks.py:370-399`, `server/services/generation_tasks.py:1033-1046` | P0(PoC필수) 타이밍게이트 | `pytest tests/test_video_duration_guard.py` |
| ARC-057 | 视频完成自动缩略图 | 视频生成后写 video_clip、video_uri，并抽取 thumbnail 回写资产。 | `server/services/generation_tasks.py:1076-1132` | P1(코어) 대시보드품질 | `pytest tests/test_video_finalize.py` |
| ARC-058 | 宫格图批量拆分成分镜 | 生成 grid 图后切单元格，保存为 canonical storyboard，并逐格登记版本。 | `server/services/generation_tasks.py:1414-1597` | P2(확장) 배치생성 | `pytest tests/test_grid_split_storyboards.py` |
| ARC-059 | 宫格参考图上限和元数据 | grid 最多收集 6 张资产 sheet，并把参考元数据持久化。 | `server/services/generation_tasks.py:1339-1411` | P2(확장) 대량효율 | `pytest tests/test_grid_references.py` |
| ARC-060 | @ 资产 mention 解析 | 支持 `@名称` 和 `@[名称]`，避免把 email/id 误判为资产引用。 | `lib/reference_video/shot_parser.py:36-80` | P1(코어) 참조편집 | `pytest tests/test_reference_mentions.py` |
| ARC-061 | Shot header 解析 | `Shot N (Xs)` 可拆成多个子镜头；无 header 时作为单镜头并允许时长覆盖。 | `lib/reference_video/shot_parser.py:82-123` | P1(코어) 씬분할 | `pytest tests/test_reference_shot_parser.py` |
| ARC-062 | 引用名解析和缺失报告 | mention 按 character、scene、prop 优先级解析，缺失项集中返回。 | `lib/reference_video/shot_parser.py:179-206` | P1(코어) 참조검증 | `pytest tests/test_reference_resolution.py` |
| ARC-063 | 参考视频执行期裁剪 | 按供应商 max_refs、max_duration 裁剪，并从最新脚本重组 prompt，保证索引对齐。 | `server/services/reference_video_tasks.py:94-142`, `server/services/reference_video_tasks.py:391-407` | P1(코어) 실행안정 | `pytest tests/test_reference_executor_constraints.py` |
| ARC-064 | 参考视频缺图策略分级 | narration/drama 缺图硬失败，ad 缺图软 warning，符合不同生产容错。 | `server/services/reference_video_tasks.py:263-309` | P1(코어) 품질정책 | `pytest tests/test_reference_missing_policy.py` |
| ARC-065 | 广告单元确定性分组 | 连续 shots 按最多 4 个和最大时长分组，产品引用优先。 | `lib/reference_video/ad_units.py:20-102` | P2(확장) 광고분组 | `pytest tests/test_ad_unit_grouping.py` |
| ARC-066 | 广告单元资产保留条件 | 只有 unit_id、shot_ids、references 完全一致时保留生成资产，否则重置。 | `lib/reference_video/ad_units.py:105-130` | P2(확장) 캐시정확성 | `pytest tests/test_ad_unit_merge_assets.py` |
| ARC-067 | 广告分镜提示不混口播 | 口播文案不进入画面 prompt，只把视觉、动作、镜头、环境和 dialogue 组合。 | `lib/reference_video/ad_units.py:187-219` | P2(확장) 영상분리 | `pytest tests/test_ad_unit_prompt_text.py` |
| ARC-068 | 广告节奏模板 | 15、30、60、90 秒有分段比例，前三秒产品露出，单 section 超 6 秒拆镜头。 | `lib/prompt_builders_ad.py:30-127` | P2(확장) 숏폼품질 | `pytest tests/test_ad_prompt_pacing.py` |
| ARC-069 | 语速下界软约束 | 按语速估算可读时长，台词超 20% 只 warning，不粗暴阻塞。 | `lib/prompt_builders_script.py:544-559`, `lib/data_validator.py:30-35` | P1(코어) TTS품질 | `pytest tests/test_speech_rate_bounds.py` |
| ARC-070 | 动态文本标签中和 | 将用户文本里的尖括号中和，防止打散 prompt 标签块。 | `lib/prompt_builders_script.py:208-212` | P1(코어) 프롬프트안전 | `pytest tests/test_prompt_tag_escape.py` |
| ARC-071 | 场景审核 gate | step1 内容在网页结构化展示，用户确认后才放行 step2 视觉生成。 | `frontend/src/components/canvas/timeline/ScriptReviewGate.tsx:163-166` | P0(PoC필수) 인간검수 | `pnpm vitest ScriptReviewGate.test.tsx` |
| ARC-072 | 审核中保留脏草稿 | Agent 或服务端刷新时，如果用户有未保存编辑，只更新服务端态不覆盖草稿。 | `frontend/src/components/canvas/timeline/ScriptReviewGate.tsx:206-228` | P1(코어) 편집안전 | `pnpm vitest ScriptReviewGate.test.tsx` |
| ARC-073 | 镜头详情脏补丁保存 | 本地草稿只提交变化字段，生成按钮可提示先保存，减少覆盖风险。 | `frontend/src/components/canvas/timeline/ShotDetail.tsx:380-529` | P0(PoC필수) 편집핵심 | `pnpm vitest ShotDetail.*.test.tsx` |
| ARC-074 | 时长 UI 能力档位 | 时长选择器按连续区间用 slider，否则用 radio，并提示不兼容时长。 | `frontend/src/components/canvas/timeline/ShotDetail.tsx:155-186`, `frontend/src/components/canvas/timeline/ShotDetail.tsx:255-332` | P1(코어) 타이밍UX | `pnpm vitest ShotDetail.*.test.tsx` |
| ARC-075 | 单镜头媒体上传替换 | 分镜或视频可人工上传替换，并更新 asset fingerprints 与版本刷新管线。 | `frontend/src/components/canvas/timeline/ShotDetail.tsx:389-411` | P1(코어) 수동보정 | `pnpm vitest MediaCard.test.tsx` |
| ARC-076 | 结构化图片提示编辑器 | scene、shot_type、lighting、ambiance 分开编辑，避免全量 prompt 文本误改。 | `frontend/src/components/canvas/timeline/ImagePromptEditor.tsx:15-80` | P1(코어) 프롬프트편집 | `pnpm vitest ImagePromptEditor.test.tsx` |
| ARC-077 | 结构化视频提示编辑器 | action、camera_motion、ambiance_audio 分开编辑，直接映射视频合同。 | `frontend/src/components/canvas/timeline/VideoPromptEditor.tsx:15-62` | P1(코어) 영상편집 | `pnpm vitest VideoPromptEditor.test.tsx` |
| ARC-078 | 旁白卡片原文对照 | UI 同屏展示只读原文、audio 播放器、生成或再生成按钮和估算费用。 | `frontend/src/components/canvas/timeline/NarrationAudioCard.tsx:39-49`, `frontend/src/components/canvas/timeline/NarrationAudioCard.tsx:81-127` | P0(PoC필수) TTS대시보드 | `pnpm vitest NarrationAudioCard.test.tsx` |
| ARC-079 | 镜头资产引用编辑 | 角色、场景、道具引用可编辑，并显示 stale 引用数量。 | `frontend/src/components/canvas/timeline/ReferencesSection.tsx:56-84`, `frontend/src/components/canvas/timeline/ReferencesSection.tsx:165-184` | P1(코어) 참조관리 | `pnpm vitest ReferencesSection.test.tsx` |
| ARC-080 | 版本恢复前端面板 | 前端按资源打开版本列表，恢复后更新指纹并保留上下文。 | `frontend/src/components/canvas/timeline/VersionTimeMachine.tsx:88-120` | P0(PoC필수) 롤백UX | `pnpm vitest VersionTimeMachine.test.tsx` |
| ARC-081 | 虚拟化镜头列表 | 长剧集用虚拟滚动，支持搜索、折叠和状态展示。 | `frontend/src/components/canvas/timeline/ShotList.tsx:60-98`, `frontend/src/components/canvas/timeline/ShotList.tsx:206-240` | P1(코어) 대시보드성능 | `pnpm vitest ShotList.*.test.tsx` |
| ARC-082 | timeline 预处理与生产双 tab | 有 step1 草稿时展示预处理 tab，脚本就绪后自动切 timeline。 | `frontend/src/components/canvas/timeline/TimelineCanvas.tsx:79-89`, `frontend/src/components/canvas/timeline/TimelineCanvas.tsx:233-280` | P1(코어) 워크플로우 | `pnpm vitest TimelineCanvas.test.tsx` |
| ARC-083 | 任务状态驱动按钮禁用 | 前端按 queued/running 任务派生 storyboard、video、tts 生成状态。 | `frontend/src/components/canvas/timeline/TimelineCanvas.tsx:128-169` | P1(코어) 중복방지 | `pnpm vitest TimelineCanvas.test.tsx` |
| ARC-084 | 参考视频单元 store | 参考视频单元按 project+episode 缓存，支持增删改、重排、生成和选择。 | `frontend/src/stores/reference-video-store.ts:23-42`, `frontend/src/stores/reference-video-store.ts:51-116` | P1(코어) 참조영상UX | `pnpm vitest reference-video-store.test.ts` |
| ARC-085 | 参考视频 optimistic 状态 | enqueue 前先置 running，结合任务表最新 updated_at 派生单元状态。 | `frontend/src/components/canvas/reference/ReferenceVideoCanvas.tsx:118-150`, `frontend/src/components/canvas/reference/ReferenceVideoCanvas.tsx:179-207` | P1(코어) 반응성 | `pnpm vitest ReferenceVideoCanvas.test.tsx` |
| ARC-086 | 参考视频草稿防丢失 | 单元 prompt 草稿跨切换保留，离页前提示，保存时同步 merge references。 | `frontend/src/components/canvas/reference/ReferenceVideoCanvas.tsx:90-91`, `frontend/src/components/canvas/reference/ReferenceVideoCanvas.tsx:262-314`, `frontend/src/components/canvas/reference/ReferenceVideoCanvas.tsx:426-434` | P1(코어) 편집보호 | `pnpm vitest ReferenceVideoCanvas.test.tsx` |
| ARC-087 | 引用增删重排原子保存 | 引用变化立即 patch，并携带未保存 prompt 草稿，避免 refs 与文本错位。 | `frontend/src/components/canvas/reference/ReferenceVideoCanvas.tsx:316-371` | P1(코어) 참조일관성 | `pnpm vitest ReferenceVideoCanvas.test.tsx` |
| ARC-088 | reference mention 编辑器 | textarea 上叠高亮层，支持 unknown mention 识别、picker 候选和 `@[name]` 插入。 | `frontend/src/components/canvas/reference/ReferenceVideoCard.tsx:90-180`, `frontend/src/components/canvas/reference/ReferenceVideoCard.tsx:258-280` | P1(코어) 참조편집 | `pnpm vitest ReferenceVideoCard.test.tsx` |
| ARC-089 | mention 键盘补全和删除 | Arrow、Enter、Tab 可选候选；Backspace 第一次选中完整 mention，第二次删除。 | `frontend/src/components/canvas/reference/MentionPicker.tsx:150-172`, `frontend/src/components/canvas/reference/ReferenceVideoCard.tsx:232-256` | P2(확장) 편집완성도 | `pnpm vitest MentionPicker.test.tsx` |
| ARC-090 | 参考视频批量生成 | 前端只对 pending 单元串行 enqueue，让后端 dedup 和 worker 并发负责实际执行。 | `frontend/src/components/canvas/reference/ReferenceVideoCanvas.tsx:247-257`, `frontend/src/components/canvas/reference/ReferenceVideoCanvas.tsx:537-547` | P1(코어) 배치생성 | `pnpm vitest ReferenceVideoCanvas.test.tsx` |

## 이 레포에서 배우지 말 것

1. 保留会生成旧合同的 helper：`create_scene_template` 仍输出 `visual/action/dialogue/audio` 旧结构，`add_scene` 还显式 `validate=False` 豁免校验。迁移时不要留下能绕过新 manifest 的公开入口。  
   근거: `lib/project_manager.py:893-923`, `lib/project_manager.py:1106-1122`

2. 能力上限从项目配置二次解析，而非来自实际 backend：代码已承认自定义模型禁用回退会导致 caps model 与 backend model 不一致，只能跳过 clamp。迁移时应让运行 backend 直接暴露能力。  
   근거: `server/services/reference_video_tasks.py:316-345`

3. 执行层硬编码供应商兜底：解析视频 backend 失败后直接落到 Gemini/Veo 默认，可能掩盖配置错误。迁移时应 fail-fast 或返回可操作配置错误。  
   근거: `server/services/generation_tasks.py:1007-1014`