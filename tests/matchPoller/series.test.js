const { test } = require(`node:test`);
const assert = require(`node:assert/strict`);
const { isSeriesDecided } = require(`../../src/workers/matchPoller/series`);

const game = (winner) => ({ winner });

test(`test_GIVEN_bo2_with_no_games_WHEN_isSeriesDecided_THEN_false`, () => {
	assert.equal(isSeriesDecided(`BO2`, []), false);
});

test(`test_GIVEN_bo2_one_game_played_WHEN_isSeriesDecided_THEN_false_no_early_clinch`, () => {
	assert.equal(isSeriesDecided(`BO2`, [game(101)]), false);
});

test(`test_GIVEN_bo2_both_maps_played_WHEN_isSeriesDecided_THEN_true_by_cap`, () => {
	assert.equal(isSeriesDecided(`BO2`, [game(101), game(202)]), true);
});

test(`test_GIVEN_bo2_split_one_one_WHEN_isSeriesDecided_THEN_true_because_both_maps_played`, () => {
	assert.equal(isSeriesDecided(`BO2`, [game(101), game(202)]), true);
});

test(`test_GIVEN_bo3_two_zero_WHEN_isSeriesDecided_THEN_true_by_clinch`, () => {
	assert.equal(isSeriesDecided(`BO3`, [game(101), game(101)]), true);
});

test(`test_GIVEN_bo3_one_one_WHEN_isSeriesDecided_THEN_false_not_clinched`, () => {
	assert.equal(isSeriesDecided(`BO3`, [game(101), game(202)]), false);
});

test(`test_GIVEN_bo3_all_three_played_WHEN_isSeriesDecided_THEN_true_by_cap`, () => {
	assert.equal(isSeriesDecided(`BO3`, [game(101), game(202), game(101)]), true);
});

test(`test_GIVEN_bo5_three_zero_WHEN_isSeriesDecided_THEN_true_by_clinch`, () => {
	assert.equal(isSeriesDecided(`BO5`, [game(101), game(101), game(101)]), true);
});

test(`test_GIVEN_bo5_two_zero_WHEN_isSeriesDecided_THEN_false_not_yet_clinched`, () => {
	assert.equal(isSeriesDecided(`BO5`, [game(101), game(101)]), false);
});

test(`test_GIVEN_unknown_match_type_WHEN_isSeriesDecided_THEN_false`, () => {
	assert.equal(isSeriesDecided(`PRE_SEASON`, [game(101), game(101), game(101)]), false);
});

test(`test_GIVEN_bo3_two_games_unscored_by_processor_WHEN_isSeriesDecided_THEN_false_clinch_ignores_null_winners`, () => {
	assert.equal(isSeriesDecided(`BO3`, [game(null), game(null)]), false);
});

test(`test_GIVEN_bo3_one_win_one_unscored_WHEN_isSeriesDecided_THEN_false`, () => {
	assert.equal(isSeriesDecided(`BO3`, [game(101), game(null)]), false);
});
