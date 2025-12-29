<?php
    global $wpdb;

    $wpdb->query( "DELETE FROM " . $wpdb->prefix .
        "ctl_arcade_games WHERE game_plugin_dir = 'ctl-roulette'");
    $wpdb->query( "DELETE FROM " . $wpdb->prefix .
        "ctl_arcade_scores WHERE game_plugin_dir = 'ctl-roulette'");
    $wpdb->query( "DELETE FROM " . $wpdb->prefix .
        "ctl_arcade_ratings WHERE game_plugin_dir = 'ctl-roulette'");

    delete_option('ctl-roulette_do_activation_redirect');