"""Unit tests for multi-frame detection aggregation (temporal noise smoothing)."""
from backend.verification.frame_aggregator import aggregate_counts


def test_single_frame_miss_is_outvoted_by_majority():
    """4 of 5 frames see 10 pencils; 1 frame (occlusion/blur) sees 9.
    The median should be 10, not the noisy single-frame value."""
    frames = [{"Pencil": 10}, {"Pencil": 10}, {"Pencil": 9}, {"Pencil": 10}, {"Pencil": 10}]
    assert aggregate_counts(frames) == {"Pencil": 10}


def test_spurious_detection_in_one_frame_is_dropped():
    """A phantom object appearing in only 1 of 5 frames should not survive
    into the final aggregated count."""
    frames = [{}, {}, {"Unknown (stop sign)": 1}, {}, {}]
    assert aggregate_counts(frames) == {}


def test_consistent_detection_across_all_frames():
    frames = [{"Book": 3}] * 5
    assert aggregate_counts(frames) == {"Book": 3}


def test_multiple_products_aggregated_independently():
    frames = [
        {"Book": 2, "Scissors": 1},
        {"Book": 2, "Scissors": 1},
        {"Book": 1, "Scissors": 1},
        {"Book": 2, "Scissors": 0},
        {"Book": 2, "Scissors": 1},
    ]
    assert aggregate_counts(frames) == {"Book": 2, "Scissors": 1}


def test_empty_frames_produce_empty_result():
    assert aggregate_counts([]) == {}
    assert aggregate_counts([{}, {}, {}]) == {}
