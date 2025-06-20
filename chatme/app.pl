#!/usr/bin/env perl
use strict;
use warnings;
use Mojolicious::Lite;
use Mojo::Util qw(md5_sum);
use DBI;
use Encode qw(encode_utf8);

# Static assets
app->static->paths->[0] = app->home->rel_file('../public');

# SQLite DB helper
helper db => sub {
  state $dbh = DBI->connect("dbi:SQLite:dbname=database/users.db", "", "", {
    RaiseError     => 1,
    AutoCommit     => 1,
    sqlite_unicode => 1,
  });

  $dbh->do(q{
    CREATE TABLE IF NOT EXISTS users (
      combo TEXT PRIMARY KEY,
      avatar TEXT,
      sessionId TEXT
    )
  });

  $dbh->do(q{
    CREATE TABLE IF NOT EXISTS general_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      avatar TEXT NOT NULL,
      msg TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  });

  return $dbh;
};

# Auth route
post '/auth' => sub {
  my $c    = shift;
  my $data = eval { $c->req->json };

  if ($@ || !$data || !ref($data) || !$data->{combo} || !$data->{mode}) {
    return $c->render(json => {
      ok => Mojo::JSON::false,
      error => 'Invalid JSON or missing fields'
    }, status => 400);
  }

  my $combo         = $data->{combo};
  my $mode          = $data->{mode};  # 'register' or 'login'
  my $combo_encoded = encode_utf8($combo);
  my $session_id    = md5_sum($combo_encoded);
  my $dbh           = $c->db;

  my $sth = $dbh->prepare("SELECT avatar FROM users WHERE combo = ?");
  $sth->execute($combo);
  my $user = $sth->fetchrow_hashref;

  if ($mode eq 'login') {
    unless ($user) {
      return $c->render(json => {
        ok => Mojo::JSON::false,
        error => 'Emoji combo not found. Please register first.'
      }, status => 401);
    }
  }

  if ($mode eq 'register') {
    if ($user) {
      return $c->render(json => {
        ok => Mojo::JSON::false,
        error => 'Emoji combo already registered. Please use login instead.'
      }, status => 409);
    }

    # Create new user
    my $avatar = "User" . int(rand(9000) + 1000);
    $dbh->do("INSERT INTO users (combo, avatar, sessionId) VALUES (?, ?, ?)",
      undef, $combo, $avatar, $session_id);
    $user = { avatar => $avatar };
  }

  # Set session cookie
  $c->cookie('session', $session_id, {
    path    => '/',
    expires => time + 86400,
    httponly => 1
  });

  $c->render(json => {
    ok        => Mojo::JSON::true,
    avatar    => $user->{avatar},
    sessionId => $session_id
  });
};

# Home
get '/' => { template => 'auth' };

# Chat page (mode selector)
get '/chat' => sub {
  my $c = shift;
  my $session_id = $c->cookie('session');

  return $c->redirect_to('/') unless $session_id;

  my $sth = $c->db->prepare("SELECT avatar FROM users WHERE sessionId = ?");
  $sth->execute($session_id);
  my $user = $sth->fetchrow_hashref;

  return $c->redirect_to('/') unless $user;

  $c->stash(avatar => $user->{avatar});
  $c->render(template => 'mode');
};

# Previous chat messages
get '/chat/general/messages' => sub {
  my $c   = shift;
  my $dbh = $c->db;

  my $sth = $dbh->prepare("SELECT avatar, msg, created_at FROM general_messages ORDER BY id ASC LIMIT 100");
  $sth->execute;
  my @messages;

  while (my $row = $sth->fetchrow_hashref) {
    push @messages, {
      avatar => $row->{avatar},
      msg    => $row->{msg},
      time   => $row->{created_at}
    };
  }

  $c->render(json => \@messages);
};


# Chat rooms
get '/chat/general' => { template => 'general' };
get '/chat/random'  => { template => 'random' };

# Logout (clear session)
get '/logout' => sub {
  my $c = shift;
  $c->cookie('session' => '', { expires => 1 });
  $c->redirect_to('/');
};

app->start;
