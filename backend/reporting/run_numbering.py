"""Cấp số hiệu duy nhất cho các lần chạy báo cáo (``*ReportRun.run_number``)."""

from __future__ import annotations

from typing import Any, Callable

from django.db import IntegrityError, transaction

MAX_RUN_NUMBER_ATTEMPTS = 20


def create_run_with_unique_number(
    model: Any,
    start_seq: int,
    make_run_number: Callable[[int], str],
    **fields: Any,
) -> Any:
    """Tạo bản ghi run, tăng số thứ tự nếu ``run_number`` đã bị request khác chiếm.

    Số thứ tự được tính bằng ``count() + 1`` nên hai request chạy cùng lúc có thể
    sinh trùng ``run_number``; mỗi lần thử nằm trong một savepoint để lỗi trùng
    không làm hỏng transaction bao ngoài.
    """
    seq = start_seq
    for _ in range(MAX_RUN_NUMBER_ATTEMPTS):
        run_number = make_run_number(seq)
        if not model.objects.filter(run_number=run_number).exists():
            try:
                with transaction.atomic():
                    return model.objects.create(run_number=run_number, **fields)
            except IntegrityError:
                if not model.objects.filter(run_number=run_number).exists():
                    raise
        seq += 1
    raise IntegrityError(f"Không cấp được run_number duy nhất cho {model.__name__}.")
