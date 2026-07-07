#!/usr/bin/env bash
# D드라이브 열람 클론 동기화 (스킬 버전관리 거점: D:\reelforge)
cd /mnt/d/reelforge && git fetch local && git reset -q --hard local/main && echo "D:\\reelforge ← $(git log --oneline -1)"
