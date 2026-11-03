-- Forward-only repair of cascade/set-null actions; no rows are copied or imported.

CREATE TRIGGER IF NOT EXISTS "d1_account_blocks_owner_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "account_blocks" WHERE "owner_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_account_blocks_blocked_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "account_blocks" WHERE "blocked_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_account_state_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "account_state" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_analytics_daily_owner_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "analytics_daily" WHERE "owner_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_analytics_events_owner_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "analytics_events" WHERE "owner_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_analytics_events_actor_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "analytics_events" WHERE "actor_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_analytics_events_resource_id_analytics_resources_id_fk_delete"
BEFORE DELETE ON "analytics_resources" FOR EACH ROW BEGIN
  DELETE FROM "analytics_events" WHERE "resource_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_analytics_follows_owner_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "analytics_follows" WHERE "owner_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_analytics_follows_actor_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "analytics_follows" WHERE "actor_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_analytics_resources_owner_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "analytics_resources" WHERE "owner_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_analytics_sessions_resource_id_analytics_resources_id_fk_delete"
BEFORE DELETE ON "analytics_resources" FOR EACH ROW BEGIN
  DELETE FROM "analytics_sessions" WHERE "resource_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_analytics_sessions_actor_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "analytics_sessions" WHERE "actor_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_announcement_dismissals_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "announcement_dismissals" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_announcement_events_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "announcement_events" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_blue_badge_store_subscriptions_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "blue_badge_store_subscriptions" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_blast_account_state_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "blast_account_state" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_blue_badge_entitlements_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "blue_badge_entitlements" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_chat_conversations_created_by_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "chat_conversations" WHERE "created_by" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_chat_legacy_archive_parts_owner_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "chat_legacy_archive_parts" WHERE "owner_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_chat_members_conversation_id_chat_conversations_id_fk_delete"
BEFORE DELETE ON "chat_conversations" FOR EACH ROW BEGIN
  DELETE FROM "chat_members" WHERE "conversation_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_chat_members_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "chat_members" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_chat_message_media_message_id_chat_messages_id_fk_delete"
BEFORE DELETE ON "chat_messages" FOR EACH ROW BEGIN
  DELETE FROM "chat_message_media" WHERE "message_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_chat_message_media_media_id_user_media_assets_id_fk_delete"
BEFORE DELETE ON "user_media_assets" FOR EACH ROW BEGIN
  DELETE FROM "chat_message_media" WHERE "media_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_chat_messages_conversation_id_chat_conversations_id_fk_delete"
BEFORE DELETE ON "chat_conversations" FOR EACH ROW BEGIN
  DELETE FROM "chat_messages" WHERE "conversation_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_chat_messages_author_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "chat_messages" WHERE "author_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_close_friend_members_owner_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "close_friend_members" WHERE "owner_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_close_friend_members_member_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "close_friend_members" WHERE "member_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_cognito_grants_session_id_sessions_id_fk_delete"
BEFORE DELETE ON "sessions" FOR EACH ROW BEGIN
  DELETE FROM "cognito_grants" WHERE "session_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_cognito_identities_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "cognito_identities" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_content_mentions_recipient_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "content_mentions" WHERE "recipient_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_content_mentions_actor_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "content_mentions" WHERE "actor_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_content_mentions_post_id_posts_id_fk_delete"
BEFORE DELETE ON "posts" FOR EACH ROW BEGIN
  DELETE FROM "content_mentions" WHERE "post_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_content_mentions_story_id_stories_id_fk_delete"
BEFORE DELETE ON "stories" FOR EACH ROW BEGIN
  DELETE FROM "content_mentions" WHERE "story_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_content_mentions_post_comment_id_post_comments_id_fk_delete"
BEFORE DELETE ON "post_comments" FOR EACH ROW BEGIN
  DELETE FROM "content_mentions" WHERE "post_comment_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_content_mentions_story_comment_id_story_comments_id_fk_delete"
BEFORE DELETE ON "story_comments" FOR EACH ROW BEGIN
  DELETE FROM "content_mentions" WHERE "story_comment_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_content_reports_reporter_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "content_reports" WHERE "reporter_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_content_reports_target_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  UPDATE "content_reports" SET "target_user_id" = NULL WHERE "target_user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_creative_drafts_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "creative_drafts" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_creator_original_content_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "creator_original_content" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_creator_program_history_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "creator_program_history" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_creator_media_assets_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "creator_media_assets" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_creator_membership_settings_creator_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "creator_membership_settings" WHERE "creator_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_creator_program_accounts_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "creator_program_accounts" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_follow_requests_requester_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "follow_requests" WHERE "requester_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_follow_requests_recipient_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "follow_requests" WHERE "recipient_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_friend_requests_requester_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "friend_requests" WHERE "requester_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_friend_requests_recipient_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "friend_requests" WHERE "recipient_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_friendships_member_low_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "friendships" WHERE "member_low_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_friendships_member_high_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "friendships" WHERE "member_high_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_membership_checkout_attempts_subscriber_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "membership_checkout_attempts" WHERE "subscriber_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_membership_checkout_attempts_creator_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "membership_checkout_attempts" WHERE "creator_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_membership_subscriptions_subscriber_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "membership_subscriptions" WHERE "subscriber_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_membership_subscriptions_creator_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "membership_subscriptions" WHERE "creator_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_participation_blocks_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "participation_blocks" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_participation_blocks_blocked_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "participation_blocks" WHERE "blocked_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_participation_boards_creator_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "participation_boards" WHERE "creator_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_participation_comments_entry_id_participation_entries_id_fk_delete"
BEFORE DELETE ON "participation_entries" FOR EACH ROW BEGIN
  DELETE FROM "participation_comments" WHERE "entry_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_participation_comments_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "participation_comments" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_participation_entries_board_id_participation_boards_id_fk_delete"
BEFORE DELETE ON "participation_boards" FOR EACH ROW BEGIN
  DELETE FROM "participation_entries" WHERE "board_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_participation_entries_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "participation_entries" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_participation_invites_board_id_participation_boards_id_fk_delete"
BEFORE DELETE ON "participation_boards" FOR EACH ROW BEGIN
  DELETE FROM "participation_invites" WHERE "board_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_participation_invites_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "participation_invites" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_participation_reactions_entry_id_participation_entries_id_fk_delete"
BEFORE DELETE ON "participation_entries" FOR EACH ROW BEGIN
  DELETE FROM "participation_reactions" WHERE "entry_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_participation_reactions_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "participation_reactions" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_participation_reports_board_id_participation_boards_id_fk_delete"
BEFORE DELETE ON "participation_boards" FOR EACH ROW BEGIN
  DELETE FROM "participation_reports" WHERE "board_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_participation_reports_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "participation_reports" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_post_comment_reactions_comment_id_post_comments_id_fk_delete"
BEFORE DELETE ON "post_comments" FOR EACH ROW BEGIN
  DELETE FROM "post_comment_reactions" WHERE "comment_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_post_comment_reactions_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "post_comment_reactions" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_post_comments_post_id_posts_id_fk_delete"
BEFORE DELETE ON "posts" FOR EACH ROW BEGIN
  DELETE FROM "post_comments" WHERE "post_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_post_comments_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "post_comments" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_post_likes_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "post_likes" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_post_likes_post_id_posts_id_fk_delete"
BEFORE DELETE ON "posts" FOR EACH ROW BEGIN
  DELETE FROM "post_likes" WHERE "post_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_post_media_assets_post_id_posts_id_fk_delete"
BEFORE DELETE ON "posts" FOR EACH ROW BEGIN
  DELETE FROM "post_media_assets" WHERE "post_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_post_media_assets_media_id_user_media_assets_id_fk_delete"
BEFORE DELETE ON "user_media_assets" FOR EACH ROW BEGIN
  DELETE FROM "post_media_assets" WHERE "media_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_post_reposts_post_id_posts_id_fk_delete"
BEFORE DELETE ON "posts" FOR EACH ROW BEGIN
  DELETE FROM "post_reposts" WHERE "post_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_post_reposts_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "post_reposts" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_posts_author_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "posts" WHERE "author_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_posts_remix_source_post_id_posts_id_fk_delete"
BEFORE DELETE ON "posts" FOR EACH ROW BEGIN
  UPDATE "posts" SET "remix_source_post_id" = NULL WHERE "remix_source_post_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_posts_sports_workout_id_sports_workouts_id_fk_delete"
BEFORE DELETE ON "sports_workouts" FOR EACH ROW BEGIN
  DELETE FROM "posts" WHERE "sports_workout_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_relationship_migrations_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "relationship_migrations" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_sports_challenges_creator_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "sports_challenges" WHERE "creator_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_sports_media_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "sports_media" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_sports_media_workout_id_sports_workouts_id_fk_delete"
BEFORE DELETE ON "sports_workouts" FOR EACH ROW BEGIN
  DELETE FROM "sports_media" WHERE "workout_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_sports_members_challenge_id_sports_challenges_id_fk_delete"
BEFORE DELETE ON "sports_challenges" FOR EACH ROW BEGIN
  DELETE FROM "sports_members" WHERE "challenge_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_sports_members_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "sports_members" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_sports_workout_tags_workout_id_sports_workouts_id_fk_delete"
BEFORE DELETE ON "sports_workouts" FOR EACH ROW BEGIN
  DELETE FROM "sports_workout_tags" WHERE "workout_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_sports_workout_tags_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "sports_workout_tags" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_sports_workout_tags_challenge_id_sports_challenges_id_fk_delete"
BEFORE DELETE ON "sports_challenges" FOR EACH ROW BEGIN
  DELETE FROM "sports_workout_tags" WHERE "challenge_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_stories_author_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "stories" WHERE "author_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_story_comments_story_id_stories_id_fk_delete"
BEFORE DELETE ON "stories" FOR EACH ROW BEGIN
  DELETE FROM "story_comments" WHERE "story_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_story_comments_author_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "story_comments" WHERE "author_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_story_reactions_story_id_stories_id_fk_delete"
BEFORE DELETE ON "stories" FOR EACH ROW BEGIN
  DELETE FROM "story_reactions" WHERE "story_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_story_reactions_actor_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "story_reactions" WHERE "actor_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_story_views_story_id_stories_id_fk_delete"
BEFORE DELETE ON "stories" FOR EACH ROW BEGIN
  DELETE FROM "story_views" WHERE "story_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_story_views_viewer_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "story_views" WHERE "viewer_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_stripe_customers_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "stripe_customers" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_user_follows_follower_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "user_follows" WHERE "follower_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_user_follows_followed_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "user_follows" WHERE "followed_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_user_media_assets_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "user_media_assets" WHERE "user_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_user_media_assets_thumbnail_id_user_media_assets_id_fk_delete"
BEFORE DELETE ON "user_media_assets" FOR EACH ROW BEGIN
  UPDATE "user_media_assets" SET "thumbnail_id" = NULL WHERE "thumbnail_id" = OLD."id";
END;

CREATE TRIGGER IF NOT EXISTS "d1_sports_workouts_user_id_users_id_fk_delete"
BEFORE DELETE ON "users" FOR EACH ROW BEGIN
  DELETE FROM "sports_workouts" WHERE "user_id" = OLD."id";
END;
