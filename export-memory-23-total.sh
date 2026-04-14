#!/bin/bash
set -e

ROOT_DIR="$(pwd)"
EXPORT_DIR="$ROOT_DIR/memory_bundle_23_total"

rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"

echo "🚀 Собираю ровно 23 файла: 1 дерево + 1 полный дамп + 21 memory files"

write_files_to_output() {
  local output="$1"
  shift
  local full_output="$EXPORT_DIR/$output"
  : > "$full_output"

  for file in "$@"; do
    [ -f "$file" ] || continue
    {
      echo "========================================"
      echo "FILE: $ROOT_DIR/${file#./}"
      echo "========================================"
      cat "$file"
      echo
      echo
    } >> "$full_output"
  done
}

write_find_group() {
  local output="$1"
  shift
  local full_output="$EXPORT_DIR/$output"
  : > "$full_output"

  for dir in "$@"; do
    [ -d "$dir" ] || continue
    find "$dir" -type f | sort | while read -r file; do
      {
        echo "========================================"
        echo "FILE: $ROOT_DIR/${file#./}"
        echo "========================================"
        cat "$file"
        echo
        echo
      } >> "$full_output"
    done
  done
}

write_rules_part() {
  local output="$1"
  shift
  local full_output="$EXPORT_DIR/$output"
  : > "$full_output"

  for file in "$@"; do
    [ -f "$file" ] || continue
    {
      echo "========================================"
      echo "FILE: $ROOT_DIR/${file#./}"
      echo "========================================"
      cat "$file"
      echo
      echo
    } >> "$full_output"
  done
}

# 00 дерево
tree -L 8 -I "node_modules|data|.git|memory_bundle_23_total" > "$EXPORT_DIR/00_project_tree.txt"

# 01 полный dump всего проекта
: > "$EXPORT_DIR/01_project_full_dump.txt"
find . -type f \
  ! -path "./node_modules/*" \
  ! -path "./data/*" \
  ! -path "./.git/*" \
  ! -path "./memory_bundle_23_total/*" \
  | sort | while read -r file; do
    {
      echo "========================================"
      echo "FILE: $ROOT_DIR/${file#./}"
      echo "========================================"
      cat "$file"
      echo
      echo
    } >> "$EXPORT_DIR/01_project_full_dump.txt"
done

# 02 memory service + config + core index
write_files_to_output "02_memory_service_config_index.txt" \
  ./src/core/memory/memory.config.js \
  ./src/core/memory/memory.service.js \
  ./src/core/index.js

# 03 pipeline + queue
write_find_group "03_memory_pipeline_queue.txt" \
  ./src/core/memory/pipeline \
  ./src/core/memory/queue

# 04 store
write_find_group "04_memory_store.txt" \
  ./src/core/memory/store

# 05 hygiene
write_find_group "05_memory_hygiene.txt" \
  ./src/core/memory/hygiene

# 06 identity + canonical + governance
write_find_group "06_memory_identity_canonical_governance.txt" \
  ./src/core/memory/identity \
  ./src/core/memory/canonical \
  ./src/core/memory/governance

# 07 raw core
write_files_to_output "07_memory_raw_core.txt" \
  ./src/core/memory/raw/extraction.settings.js \
  ./src/core/memory/raw/raw-extraction.builder.js \
  ./src/core/memory/raw/raw-extraction.normalize.js \
  ./src/core/memory/raw/raw-extraction.service.js \
  ./src/core/memory/raw/prompts/raw-extraction.prompt.js

# 08 raw strategies
write_find_group "08_memory_raw_strategies.txt" \
  ./src/core/memory/raw/strategies

# 09 reply + shared
write_find_group "09_reply_and_shared.txt" \
  ./src/core/reply \
  ./src/shared

# 10 support services + helper scripts
write_files_to_output "10_support_services_and_scripts.txt" \
  ./src/services/file.service.js \
  ./src/services/logger.service.js \
  ./src/services/llm.service.js \
  ./src/config/env.js \
  ./scripts/cleanup-memory.js \
  ./scripts/test-llm-extractor.js

# 11 regex index + runtime
write_files_to_output "11_regex_index_runtime.txt" \
  ./src/core/memory/extractors/regex/index.js \
  ./src/core/memory/extractors/regex/runtime.js

# 12 regex core
write_find_group "12_regex_core.txt" \
  ./src/core/memory/extractors/regex/core

# 13 regex builders
write_find_group "13_regex_builders.txt" \
  ./src/core/memory/extractors/regex/builders

# 14-16 regex rules на 3 части
mapfile -t RULE_FILES < <(find ./src/core/memory/extractors/regex/rules -type f 2>/dev/null | sort)
RULE_COUNT=${#RULE_FILES[@]}
chunk_size=$(( (RULE_COUNT + 2) / 3 ))

part1=( "${RULE_FILES[@]:0:chunk_size}" )
part2=( "${RULE_FILES[@]:chunk_size:chunk_size}" )
part3=( "${RULE_FILES[@]:chunk_size*2:chunk_size}" )

write_rules_part "14_regex_rules_part_1.txt" "${part1[@]}"
write_rules_part "15_regex_rules_part_2.txt" "${part2[@]}"
write_rules_part "16_regex_rules_part_3.txt" "${part3[@]}"

# 17 regex debug + llm debug
write_find_group "17_extractors_debug.txt" \
  ./src/core/memory/extractors/regex/debug \
  ./src/core/memory/extractors/llm/debug

# 18 llm extractor
write_find_group "18_llm_extractor.txt" \
  ./src/core/memory/extractors/llm

# 19 regex base tests
write_files_to_output "19_tests_regex_main.txt" \
  ./tests/regex-atoms.basic.test.js \
  ./tests/regex/extractRegexAtomsV1.test.js \
  ./tests/regex/extractRegexAtomsV1.overlap.test.js \
  ./tests/regex/heuristic.strategy.bridge.test.js \
  ./tests/regex/llm.strategy.temporal.test.js

# 20 extractor tests part A
write_files_to_output "20_tests_extractors_part_a.txt" \
  ./tests/action.extractor.test.js \
  ./tests/affect.extractor.test.js \
  ./tests/entity.extractor.test.js \
  ./tests/episodic.extractor.test.js \
  ./tests/fact.extractor.test.js

# 21 extractor tests part B
write_files_to_output "21_tests_extractors_part_b.txt" \
  ./tests/openLoop.extractor.test.js \
  ./tests/openLoop.llm-extractor.test.js \
  ./tests/scene.extractor.test.js \
  ./tests/signal.extractor.test.js \
  ./tests/temporal.extractor.test.js

# 22 optional current data snapshot
write_files_to_output "22_memory_data_snapshot.txt" \
  ./src/core/memory/data/events.json \
  ./src/core/memory/data/memory.json \
  ./src/core/memory/data/snapshot.json

echo "✅ Готово"
echo "Проверка количества файлов:"
find "$EXPORT_DIR" -maxdepth 1 -type f | wc -l
echo "Папка: $EXPORT_DIR"
