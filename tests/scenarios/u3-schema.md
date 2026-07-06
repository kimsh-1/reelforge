# U-3 Schema/VF Misuse Scenario

Scope: P1-06 U-3 갱신. Source contracts: `docs/contracts.md`, `research/06-plan/VERIFICATION-PLAN.md` L4 U-3.

Command:

```sh
node tests/u3-suite.mjs
```

판정 기준: 각 오조작 입력에 대해 AJV, `vf write`, 적용 가능한 `vf gate`를 실제 실행한다. 어느 검증면에서도 명확한 반려가 없으면 결함으로 기록한다. 크래시와 무한대기는 별도 결함으로 기록한다.

Last run: 2026-07-07 KST, `node tests/u3-suite.mjs`

Summary: 20종 실행, 20종 명확 반려, 0종 vf 결함.

| ID | 입력 | 기대 | 실측 | 판정 |
|---|---|---|---|---|
| U3-01 | `scene_specs.scenes[0].narration = ""` | `narration` minLength 위반 반려 | AJV reject, `vf write` reject | 반려 확인 |
| U3-02 | `narration`/`narration_tts` 30,000자 | 비정상 장문 입력 반려 | AJV reject, `vf write` reject | 반려 확인 |
| U3-03 | headline에 U+200B zero-width와 emoji | zero-width 제목 문자 반려, emoji 자체는 허용 | AJV reject, `vf write` reject | 반려 확인 |
| U3-04 | `sceneId = "s@01"` | `sceneId` pattern 위반 반려 | AJV reject, `vf write` reject | 반려 확인 |
| U3-05 | `transitions[0].from == transitions[0].to` | self-loop transition 반려 | AJV accept, `vf write` semantic reject | 반려 확인 |
| U3-06 | `transition.to = "s99"` but no `s99` scene | 존재하지 않는 sceneId 참조 반려 | AJV accept, `vf write` semantic reject | 반려 확인 |
| U3-07 | `words[0].end < words[0].start` | word timing 역전 반려 | AJV accept, `vf write` semantic reject | 반려 확인 |
| U3-08 | uppercase `sourceHash` | lowercase SHA-256 pattern 위반 반려 | AJV reject, `vf write` reject | 반려 확인 |
| U3-09 | `audioDurationSec = -0.1` | duration minimum 위반 반려 | AJV reject, `vf write` reject | 반려 확인 |
| U3-10 | existing 0-byte `./assets/audio/zero.mp3` | 0-byte asset 반려 | AJV accept, `vf write` accept, `vf gate l0-6` reject | 반려 확인 |
| U3-11 | malformed JSON stdin to `vf write` | JSON parse error 반려 | AJV parse reject, `vf write` parse reject | 반려 확인 |
| U3-12 | `./assets/audio/link.mp3` symlink to repo file | symlink asset path 반려 | AJV accept, `vf write` accept, `vf gate l0-6` reject | 반려 확인 |
| U3-13 | `audioPath = "./assets/../outside.mp3"` | path traversal 반려 | AJV accept, `vf write` accept, `vf gate l0-6` reject | 반려 확인 |
| U3-14 | `headline = null` | required string type 위반 반려 | AJV reject, `vf write` reject | 반려 확인 |
| U3-15 | `scene_specs.scenes.length = 500` | 비정상 대량 입력 반려 | AJV reject, `vf write` reject | 반려 확인 |
| U3-16 | duplicate `sceneId = "s01"` | duplicate sceneId 반려 | AJV accept, `vf write` semantic reject | 반려 확인 |
| U3-17 | `versions.resources.image.selected = "gen_99"` with only `gen_01` entry | selected gen missing from entries 반려 | AJV accept, `vf write` semantic reject, `vf gate l0-12` reject | 반려 확인 |
| U3-18 | `overrides.headline.x = 200` | percent maximum 위반 반려 | AJV reject, `vf write` reject | 반려 확인 |
| U3-19 | `subtitleMode = "mystery"` | enum 위반 반려 | AJV reject, `vf write` reject | 반려 확인 |
| U3-20 | JSON stdin starts with BOM | JSON parse error 반려 | AJV parse reject, `vf write` parse reject | 반려 확인 |

## 해결 확인

- U3-02: `narration` maxLength 2000, `narration_tts` maxLength 3000으로 AJV 반려.
- U3-03: headline/title 안전 패턴으로 제어문자와 zero-width 문자를 반려하며 emoji는 허용.
- U3-05/U3-06/U3-16: `src/gates/semantic.mjs`가 transition self-loop, dangling reference, duplicate `sceneId`를 반려.
- U3-07: semantic word timing 검증이 `end >= start`와 단조 증가를 반려.
- U3-10/U3-12/U3-13: L0-6 asset 검증이 0-byte, symlink, `../` traversal을 반려.
- U3-15: `scene_specs.scenes` maxItems 120으로 AJV 반려.
- U3-17: semantic versions 검증이 `selected`가 `entries[].gen`에 없으면 반려.
