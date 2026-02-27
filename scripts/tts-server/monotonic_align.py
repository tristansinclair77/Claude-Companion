"""Stub for monotonic_align.
This C-extension module is only required for TRAINING (the forward() pass).
Inference (infer()) never calls maximum_path, so this stub is sufficient.
"""


def maximum_path(value, mask):
    raise RuntimeError(
        "monotonic_align.maximum_path is only used during training "
        "and should never be called during inference."
    )
