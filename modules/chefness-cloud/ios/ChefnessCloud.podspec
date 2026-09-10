Pod::Spec.new do |s|
  s.name = 'ChefnessCloud'
  s.version = '1.0.0'
  s.summary = 'Private CloudKit transport for Chefness'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Chefness'
  s.homepage = 'https://chefness.org'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CloudKit'
  s.source_files = '**/*.swift'
end
